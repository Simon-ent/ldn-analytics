/*
*   Function that computes all LDN sub indicators and returns the images and a feature collection
*/

/*
*   Datasets
*/
var landCoverCollection = ee.ImageCollection("MODIS/006/MCD12Q1")
    .select('LC_Type1');

var soilCarbonTop = ee.Image("OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02")
  .select(['b0']);

/*
*   Land Cover
*/

// Re-maps Modis classes to those in Trends.Earth
// tree-cover (1-9) = 1
// grasslands (10) = 2
// cropland (12 and 14) = 3
// wetland (11) = 4
// artificial (13) = 5
// bare land (15-16) = 6
// water bodies (18) = 7
var remapLandCoverYear1 = function(startImage) {
    return startImage.remap([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
        [10,10,10,10,10,10,10,10,10,20,40,30,50,30,60,60,70]);
}

var remapLandCoverYear2 = function(endImage) {
    return endImage.remap([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
        [1,1,1,1,1,1,1,1,1,2,4,3,5,3,6,6,7]);
}

var LandCoverTransistions = function(startImage, endImage) {
    // remap individually the land classes for both years
    var landCoverYear1 = remapLandCoverYear1(startImage);
    // NOTE: becasue direction matters, eg 2 to 1 diff than 1 to 2
    // year 1 is reclassified to year*10 to that transitions 12 and 21 are discernible
    var landCoverYear2 = remapLandCoverYear2(endImage)
    return landCoverYear1.add(landCoverYear2);
}

var LandCoverChangeImage = function(transitions) {
    // remaps transitions according to Earth trends
    // http://trends.earth/docs/en/training/tutorial_run_all_subindicators.html
    // Step 7
    var remapped_transitions = transitions.remap(
        [11,12,13,14,15,16,17,
        21,22,23,24,25,26,27,
        31,32,33,34,35,36,37,
        41,42,43,44,45,46,47,
        51,52,53,54,55,56,57,
        61,62,63,64,65,66,67,
        71,72,73,74,75,76,77],
        [0,-1,-1,-1,-1,-1,0,    //Tree-cover
        1,0,1,-1,-1,-1,0,       //Grassland
        1,-1,0,-1,-1,-1,0,      //Cropland
        -1,-1,-1,0,-1,-1,0,     //Wetland
        1,1,1,1,0,1,0,          //Artificial
        1,1,1,1,-1,0,0,         //Bareland
        0,0,0,0,0,0,0]          //Water
    );
    return remapped_transitions
}

/*
*   Soil Organic Carbon
*/

var SoilOrganicCarbonChange = function(landCoverTransistions, SoilTopImage) {
    // Remapping land transitions to soil carbon loss/gain factors
    // following the same logic as in earth trends
    // http://trends.earth/docs/en/background/understanding_indicators15.html
    // values 1 in earth trends table is zero in the remap table
    var remapped_soilTransitions = landCoverTransistions.remap(
        [11,12,13,14,15,16,17,
        21,22,23,24,25,26,27,
        31,32,33,34,35,36,37,
        41,42,43,44,45,46,47,
        51,52,53,54,55,56,57,
        61,62,63,64,65,66,67,
        71,72,73,74,75,76,77],
        [0,0,1.7,0,2,2,0,
        0,0,1.7,0,2,2,0,
        -0.58,-0.58,0,-0.71,2,2,0,
        0,0,1.4,0,2,2,0,
        -0.1,-0.1,-0.1,-0.1,0,0,0,
        -0.1,-0.1,-0.1,-0.1,0,0,0,
        0,0,0,0,0,0,0]
    );

    // Soil carbon lost/gain "after 20 years of land cover change"
    var carbonChange = SoilTopImage.multiply(remapped_soilTransitions);
    // Addapt the change in carbon to the 9 years of our analysis
    // so that the change should be only 45% of the potential 
    var carbonChangeAdjusted = carbonChange.multiply(0.45);

    // Add the carbon lost/gain (change) to the original soil carbon
    var carbonFinal = SoilTopImage.add(carbonChangeAdjusted);
    // Determine the % change to the original carbon stock
    var carbonFracChange = carbonFinal.divide(SoilTopImage).subtract(1);

    // Remaps the fraction of carbon to improving, degrading or stable
    // following the 10% cutoff in earth trends
    var carbonFracRemaped = ee.Image(4)
            .where(carbonFracChange.gt(0.1).and(carbonFracChange.lte(1)), 2)//improving
            .where(carbonFracChange.gt(-1).and(carbonFracChange.lte(-0.1)), 3)//degrading
            .where(carbonFracChange.gt(-0.1).and(carbonFracChange.lte(0.1)), 0);//stable

    return carbonFracRemaped.updateMask(carbonFracRemaped.lt(4))
}

/*
 * Consolidated Regional Data
 */

var RegionalScores = function(remapped_transitions, subRegions) {
    var regionScore = remapped_transitions.reduceRegions({
        collection: subRegions,
        reducer: ee.Reducer.sum().combine(
            ee.Reducer.count(), '', true),
        scale: 500
    });
    var calculatePercentageDegraded = function(feature) {
        var state = ee.Number(feature.get('sum'));
        var area = ee.Number(feature.get('count'));
        return feature.set({Degraded_State: state.divide(area)})
      }
      
    regionScore = regionScore.map(calculatePercentageDegraded);
    return regionScore
}

var RegionalScoresImage = function(regionScores) {
    var canvas = ee.Image().byte()
    canvas = canvas.paint({
        featureCollection: regionScores,
        color: 'Degraded_State'
    })
    return canvas
}

/*
 * Table Data
 */

function generateLandCoverTypeSummaryFeature(baseImage, year, target, subRegions) {
    var regionalData =
        baseImage.reduceRegions({
            'collection': subRegions,
            'reducer': ee.Reducer.frequencyHistogram(),
            'scale': 500
        })
        .map(function(feature) {
            // map through feature collection and unpack histogram values
            var histogramResults = ee.Dictionary(feature.get('histogram'));
            return ee.Feature(null, {
                'system:index': feature.get('system:index'),
                'ADM0_NAME': feature.get('ADM0_NAME'),
                'ADM1_NAME': feature.get('ADM1_NAME'),
                'ADM2_NAME': feature.get('ADM2_NAME'),
                'Shape_Area': feature.get('Shape_Area'),
                'Year': year,
                'Target': target,
                'Tree_Cover': ee.Number(histogramResults.get('1', 0)).toFloat(),
                'Grasslands': ee.Number(histogramResults.get('2', 0)).toFloat(),
                'Croplands': ee.Number(histogramResults.get('3', 0)).toFloat(),
                'Wetlands': ee.Number(histogramResults.get('4', 0)).toFloat(),
                'Artificial': ee.Number(histogramResults.get('5', 0)).toFloat(),
                'Bare_Land': ee.Number(histogramResults.get('6', 0)).toFloat(),
                'Water_Bodies': ee.Number(histogramResults.get('7', 0)).toFloat(),
            })
        })
    return regionalData
}

function calculateLandCoverTransistions(transistions, subRegions) {
    var transistionsCount = transistions.reduceRegions({
        collection: subRegions,
        reducer: ee.Reducer.frequencyHistogram(),
        scale: 500
    })
    var netTranistions = transistionsCount.map(function(feature) {
        var histogramResults = ee.Dictionary(feature.get('histogram'));
      
        function calculateNetTransition(positiveTransition, negativeTransition) {
          var positiveTransistionNum = ee.Number(histogramResults.get(positiveTransition, 0));
          var negativeTransistionNum = ee.Number(histogramResults.get(negativeTransition, 0)).multiply(-1);
          return positiveTransistionNum.add(negativeTransistionNum)
        }
      
        return ee.Feature(null, {
          'ADM0_NAME': feature.get('ADM0_NAME'),
          'ADM1_NAME': feature.get('ADM1_NAME'),
          'ADM2_NAME': feature.get('ADM2_NAME'),
          'Tree_Cover to Grasslands': calculateNetTransition('21', '12'),
          'Tree_Cover to Croplands': calculateNetTransition('31', '13'),
          'Tree_Cover to Artificial': calculateNetTransition('51', '15'),
          'Grasslands to Croplands': calculateNetTransition('23', '32'),
          'Grasslands to Artificial': calculateNetTransition('52', '25'),
          'Bare_Land to Grasslands' : calculateNetTransition('62', '26'),
          'Bare_Land to Croplands' : calculateNetTransition('63', '36'),
          'Bare_Land to Artificial' : calculateNetTransition('65', '56'),
        })
      
    })
    return netTranistions
}

/*
 * Outputs
 */

// exports.LDNIndicatorImages = function(startYear, targetYear, subRegions) {
//     var landCoverStartImage = landCoverCollection.filterDate(startYear + '-01-01', startYear + '-12-31').first()
//     var landCoverEndImage = landCoverCollection.filterDate(targetYear + '-01-01', targetYear + '-12-31').first()
//     var landCoverTransistions = LandCoverTransistions(landCoverStartImage, landCoverEndImage);
//     var landCoverChange = LandCoverChangeImage(landCoverTransistions);
//     var soilOrganicCarbonChange = SoilOrganicCarbonChange(landCoverTransistions, soilCarbonTop);
//     var regionalLandCoverChange = RegionalScores(landCoverChange, subRegions);
//     var regionalLandCoverChangeImage = RegionalScoresImage(regionalLandCoverChange);
//     return [landCoverChange, soilOrganicCarbonChange, regionalLandCoverChangeImage]
// }

exports.LDNIndicatorData = function(startYear, targetYear, subRegions) {
    var landCoverStartImage = landCoverCollection.filterDate(startYear + '-01-01', startYear + '-12-31').first()
    var landCoverEndImage = landCoverCollection.filterDate(targetYear + '-01-01', targetYear + '-12-31').first()
    var landCoverTransistions = LandCoverTransistions(landCoverStartImage, landCoverEndImage);
    var landCoverChange = LandCoverChangeImage(landCoverTransistions);
    var soilOrganicCarbonChange = SoilOrganicCarbonChange(landCoverTransistions, soilCarbonTop);
    var regionalLandCoverChange = RegionalScores(landCoverChange, subRegions);
    var regionalLandCoverChangeImage = RegionalScoresImage(regionalLandCoverChange);
    
    var landCoverStartCount = generateLandCoverTypeSummaryFeature(remapLandCoverYear2(landCoverStartImage), startYear, false, subRegions);
    var landCoverEndCount = generateLandCoverTypeSummaryFeature(remapLandCoverYear2(landCoverEndImage), targetYear, false, subRegions);
    var landCoverTransistionsCount = calculateLandCoverTransistions(landCoverTransistions, subRegions);

    landCoverStartCount = landCoverStartCount.set({id: 'landCoverStartCount'});
    landCoverEndCount = landCoverEndCount.set({id: 'landCoverEndCount'});
    landCoverTransistionsCount = landCoverTransistionsCount.set({id: 'landCoverTransistionsCount'});
    var predictionsData = ee.FeatureCollection([landCoverStartCount, landCoverEndCount, landCoverTransistionsCount]);
    predictionsData = predictionsData.set({id: 'predictions'});

    return [landCoverChange, soilOrganicCarbonChange, regionalLandCoverChangeImage, 
        landCoverStartCount, landCoverEndCount, landCoverTransistionsCount, predictionsData]
}

/*
 * Testing
 */

// var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
// var worldRegions = ee.FeatureCollection("FAO/GAUL/2015/level1");
// var worldSubRegions = ee.FeatureCollection("FAO/GAUL/2015/level2");

// var country = 'Ghana';
// var startYear = '2009';
// var targetYear = '2019';

// var countryGeometry = countries.filter(ee.Filter.eq('ADM0_NAME', country));
// var regions = worldRegions.filter(ee.Filter.eq('ADM0_NAME', country));
// var subRegions = worldSubRegions.filter(ee.Filter.eq('ADM0_NAME', country));

// var RegionsOverlay = function(baseImage, regions, subRegions) {
//     var output = baseImage.paint({
//         featureCollection: subRegions, 
//         color: 4, 
//         width: 1
//     }).paint({
//         featureCollection: regions, 
//         color: 4, 
//         width: 2
//     });
//     return output
// }

// var landCoverStartImage = landCoverCollection.filterDate(startYear + '-01-01', startYear + '-12-31').first()
// .clip(countryGeometry);

// var landCoverEndImage = landCoverCollection.filterDate(targetYear + '-01-01', targetYear + '-12-31').first()
// .clip(countryGeometry);

// var landCoverTransistions = LandCoverTransistions(landCoverStartImage, landCoverEndImage);

// var landCoverChange = LandCoverChangeImage(landCoverTransistions);

// var landCover = RegionsOverlay(landCoverChange, regions, subRegions);
// Map.addLayer(landCover,{min: -1, max: 2, palette: ['fc8d59', '#ffffbf', '1a9850', '808080']}, 'Land Cover', true, 0.75);

// var soilOrganicCarbonChange = SoilOrganicCarbonChange(landCoverTransistions, soilCarbonTop);
// var soilOrganicCarbon = RegionsOverlay(soilOrganicCarbonChange, regions, subRegions);
// Map.addLayer(soilOrganicCarbon,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850', '808080']}, 'Soil Organic Carbon', false, 0.75);
// Map.addLayer(soilOrganicCarbonChange,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Soil Organic Carbon Change', false, 0.75);
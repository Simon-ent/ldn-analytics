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

var LandCoverTransitions = function(startImage, endImage) {
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

var SoilOrganicCarbonChange = function(landCoverTransitions, SoilTopImage, startYear, targetYear) {
    // Remapping land transitions to soil carbon loss/gain factors
    // following the same logic as in earth trends
    // http://trends.earth/docs/en/background/understanding_indicators15.html
    // values 1 in earth trends table is zero in the remap table
    var f = 0.8
    var remapped_soilTransitions = landCoverTransitions.remap(
        [11,12,13,14,15,16,17,
        21,22,23,24,25,26,27,
        31,32,33,34,35,36,37,
        41,42,43,44,45,46,47,
        51,52,53,54,55,56,57,
        61,62,63,64,65,66,67,
        71,72,73,74,75,76,77],
        [1,1,f,1,0.1,0.1,1,         //Tree-cover
        1,1,f,1,0.1,0.1,1,          //Grassland
        1/f,1/f,1,1/f,0.1,0.1,1,    //Cropland
        1,1,0.71,1,0.1,0.1,1,       //Wetland
        2,2,2,2,1,1,1,              //Artificial
        2,2,2,2,1,1,1,              //Bareland
        1,1,1,1,1,1,1]              //Water
    );

    // Determine Soil carbon "after 20 years of land cover change" by applying the factors as in earthtrends
    var Carbon20 =  SoilTopImage.multiply(remapped_soilTransitions);

    // Determine the change between carbon 20 years from now and "present"
    var CarbonDiff = Carbon20.subtract(SoilTopImage);

    // Determine yearly change in soil carbon - 20 years in total
    var CarbonYearlyChange = CarbonDiff.divide(20);

    // Set the number of years for the analysis
    var Nyears = Number(targetYear) - Number(startYear);

    // Determine carbon at Nyears
    // Basically it multiplies the yearly change by a number of years and adds it to the original soil carbon. 
    var CarbonYearX = CarbonYearlyChange.multiply(Nyears).add(SoilTopImage);

    // Determine variation in % to reference
    var varSoilCarbon = CarbonYearX.divide(SoilTopImage);

    return varSoilCarbon
}

var SoilOrganicCarbonChangeClassified = function(varSoilCarbon) {
    // Remaps the fraction of carbon to improving, degrading or stable
    // following the 10% + or - cutoff in earth trends
    var carbonFracRemaped = ee.Image(4)
            .where(varSoilCarbon.gte(1.10), 1)//improving 
            .where(varSoilCarbon.gt(0).and(varSoilCarbon.lte(0.90)), -1)//degrading 
            .where(varSoilCarbon.gt(0.90).and(varSoilCarbon.lt(1.10)), 0);//stable 

    return carbonFracRemaped.updateMask(carbonFracRemaped.lt(4))
}

/**
 * Productivity
 * Sub indicator TRAJECTORY
 */

function productivityTrajectory(){
    // Import annual NPP and filter time and bounds
    var NPP = ee.ImageCollection("MODIS/006/MOD17A3HGF").select('Npp')
    .filterDate('2002-01-01', '2019-01-01');

    //Join collection to itself with a temporal filter
    //Temporal filter
    var afterFilter = ee.Filter.lessThan({
    leftField: 'system:time_start',
    rightField: 'system:time_start'
    });
    //Joins both collections
    var joined = ee.ImageCollection(ee.Join.saveAll('after').apply({
    primary: NPP,
    secondary: NPP,
    condition: afterFilter
    }));

    // STEP1 - make Kendall trend test
    // Determines the sign of the NPP slopes, positive (improving) or negative (degrading)
    // based on the sum of the e sums of the signs of all 
    // the NPP pair at time t and t+1

    // Sets function to determine the sums of the NPP pairs
    var sign = function(i, j) { // i and j are images
    return ee.Image(j).neq(i) // Zero case
        .multiply(ee.Image(j).subtract(i).clamp(-1, 1)).int();
    };

    // Apply kendall test to retrieve positive and negative trends
    // This results will then need to be overlayed with the significance value p
    var kendall = ee.ImageCollection(joined.map(function(current) {
    var afterCollection = ee.ImageCollection.fromImages(current.get('after'));
    return afterCollection.map(function(image) {
        return ee.Image(sign(current, image)).unmask(0);
    });
    }).flatten()).reduce('sum', 2);

    //STEP2 - determines the variance of Kendall slopes
    // Function to determnine values that are in a group
    var groups = NPP.map(function(i) {
    var matches = NPP.map(function(j) {
        return i.eq(j); // i and j are images.
    }).sum();
    return i.multiply(matches.gt(1));
    });

    // Function to compute group sizes
    var group = function(array) {
    var length = array.arrayLength(0);
    // Array of indices
    var indices = ee.Image([1])
        .arrayRepeat(0, length)
        .arrayAccum(0, ee.Reducer.sum())
        .toArray(1);
    var sorted = array.arraySort();
    var left = sorted.arraySlice(0, 1);
    var right = sorted.arraySlice(0, 0, -1);
    // Make indices of the end of runs.
    var mask = left.neq(right)
        .arrayCat(ee.Image(ee.Array([[1]])), 0);
    var runIndices = indices.arrayMask(mask);
    // Subtract the indices to get run lengths.
    var groupSizes = runIndices.arraySlice(0, 1)
        .subtract(runIndices.arraySlice(0, 0, -1));
    return groupSizes;
    };

    var factors = function(image) {
    return image.expression('b() * (b() - 1) * (b() * 2 + 5)');
    };

    var groupSizes = group(groups.toArray());
    var groupFactors = factors(groupSizes);
    var groupFactorSum = groupFactors.arrayReduce('sum', [0])
        .arrayGet([0, 0]);

    var count = joined.count();
    // Make Kedall variance 
    var kendallVariance = factors(count)
        .subtract(groupFactorSum)
        .divide(18)
        .float();

    // STEP 3 - Computes a standard normal Kendall statistics
    // Subset the cases of zero, positive and negative from Kendal statistics
    var zero = kendall.multiply(kendall.eq(0));
    var pos = kendall.multiply(kendall.gt(0)).subtract(1);
    var neg = kendall.multiply(kendall.lt(0)).add(1);

    // Divide the statistics by the standard deviation
    var z = zero
        .add(pos.divide(kendallVariance.sqrt()))
        .add(neg.divide(kendallVariance.sqrt()));

    // Compute the Cumulate distribution functions
    function eeCdf(z) {
    return ee.Image(0.5)
        .multiply(ee.Image(1).add(ee.Image(z).divide(ee.Image(2).sqrt()).erf()));
    }

    function invCdf(p) {
    return ee.Image(2).sqrt()
        .multiply(ee.Image(p).multiply(2).subtract(1).erfInv());
    }

    // Compute P-values.
    var p = ee.Image(1).subtract(eeCdf(z.abs()));

    // Pixels where trend is significant have p values below 0.05
    var sigPixels =p.lte(0.025);

    // Multiplies the significant pixels with the Kendall trends from STEP 1
    // This makes non-sig pixels 0 (stable) and all the others get the original
    // value of the Kendal trend, either positive or negative
    var sigTrend = kendall.multiply(sigPixels);

    return sigTrend
}

var productivityTrajectoryClassified = function(sigTrend) {

    // Remaps the significant production trends according to the earth trends logic
    var trajectoryRemaped = ee.Image(4)
            .where(sigTrend.gt(0), 1)//improving
            .where(sigTrend.lt(0), -1)//degrading
            .where(sigTrend.eq(0), 0);//stable

    // the masking is to remove water bodies from being flaged as degrading.
    trajectoryRemaped = trajectoryRemaped.updateMask(trajectoryRemaped.lt(4));

    // Map.addLayer(trajectoryRemaped.updateMask(trajectoryRemaped.lt(4)),
    // {min: 0, max: 3, palette: ['ffffbf', '#1a9850', 'fc8d59']},'trajectory');

    return trajectoryRemaped
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
        return feature.set('Degraded_State', state.divide(area), 'Pixel_Count', area)
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

function generateLandCoverTypeSummaryFeature(baseImage, name, subRegions) {
    var regionalData =
        baseImage.reduceRegions({
            'collection': subRegions,
            'reducer': ee.Reducer.frequencyHistogram(),
            'scale': 500
        })
        .map(function(feature) {
            // map through feature collection and unpack histogram values
            var histogramResults = ee.Dictionary(feature.get('histogram'));
            var landCoverSummary = ee.Dictionary({
                'Tree_Cover': ee.Number(histogramResults.get('1', 0)).toInt(),
                'Grasslands': ee.Number(histogramResults.get('2', 0)).toInt(),
                'Croplands': ee.Number(histogramResults.get('3', 0)).toInt(),
                'Wetlands': ee.Number(histogramResults.get('4', 0)).toInt(),
                'Artificial': ee.Number(histogramResults.get('5', 0)).toInt(),
                'Bare_Land': ee.Number(histogramResults.get('6', 0)).toInt(),
                'Water_Bodies': ee.Number(histogramResults.get('7', 0)).toInt(),
            })
            var landCover = ee.Algorithms.If(feature.get('landCover'), feature.get('landCover'), null) 
            landCover = ee.Dictionary(landCover).set(name, landCoverSummary)

            return feature.set('landCover', landCover)
        })
    return regionalData
}

function calculateLandCoverTransitions(transitions, name, subRegions) {
    var transitionsCount = transitions.reduceRegions({
        collection: subRegions,
        reducer: ee.Reducer.frequencyHistogram(),
        scale: 500
    })
    var netTranistions = transitionsCount.map(function(feature) {
        var histogramResults = ee.Dictionary(feature.get('histogram'));
      
        function calculateNetTransition(positiveTransition, negativeTransition) {
          var positiveTransistionNum = ee.Number(histogramResults.get(positiveTransition, 0));
          var negativeTransistionNum = ee.Number(histogramResults.get(negativeTransition, 0)).multiply(-1);
          return positiveTransistionNum.add(negativeTransistionNum)
        }
        
        var transitionSummary = ee.Dictionary({
          'Tree_Cover to Grasslands': calculateNetTransition('21', '12').toInt(),
          'Tree_Cover to Croplands': calculateNetTransition('31', '13').toInt(),
          'Tree_Cover to Artificial': calculateNetTransition('51', '15').toInt(),
          'Grasslands to Croplands': calculateNetTransition('23', '32').toInt(),
          'Grasslands to Artificial': calculateNetTransition('52', '25').toInt(),
          'Bare_Land to Grasslands' : calculateNetTransition('62', '26').toInt(),
          'Bare_Land to Croplands' : calculateNetTransition('63', '36').toInt(),
          'Bare_Land to Artificial' : calculateNetTransition('65', '56').toInt(),
        })

        var landCoverTransitions= ee.Algorithms.If(feature.get('landCoverTransitions'), feature.get('landCoverTransitions'), null) 
        landCoverTransitions = ee.Dictionary(landCoverTransitions).set(name, transitionSummary)

        return feature.set('landCoverTransitions', landCoverTransitions)
    })
    return netTranistions
}

function calculateSDG(landCoverChange, countryGeometry) {
    var pixelCount = landCoverChange.reduceRegion(
        ee.Reducer.fixedHistogram(-1, 1, 3),
        countryGeometry,
        500
    ).get('remapped');
    var degredationCount = ee.Array(pixelCount).get([0,1])
    var totalPixel = landCoverChange.reduceRegion(
        ee.Reducer.count(),
        countryGeometry,
        500
    ).get('remapped');

    var SDG = ee.Number(degredationCount).divide(totalPixel)
    var SDGOutput = ee.Number(SDG).multiply(100).format('%.0f') 
    return SDGOutput
}

exports.calculateRegionalSDG = function(landCoverChange, subRegions) {
    var pixelCount = landCoverChange.reduceRegions(
        ee.Reducer.fixedHistogram(-1, 1, 3),
        countryGeometry,
        500
    )
    return pixelCount

    // var updateFeature = function(feature) {
    //     var degredationCount = ee.Array(pixelCount).get([0,1])
    //     return feature.set({'Social Carbon Cost': SCC})
    //   }
      
    // regionalCarbonCost = regionalCarbonCost.map(updateFeature);
    
    

    // var SDG = ee.Number(degredationCount).divide(totalPixel)
    // var SDGOutput = ee.Number(SDG).multiply(100).format('%.0f') 
    // return SDGOutput
}

function calculateNationalNetChange(regionalScores) {
    var nationalIndicator = regionalScores.reduceColumns(ee.Reducer.sum(), ['Degraded_State']);
    return ee.Number(nationalIndicator.get('sum')).format('%.2f')
}

function socialCarbonCost(soilOrganicCarbonChange, subRegions) {
    // Load data with information on "bulk density" of soil, that is how many kg of soil exist under an m3 of soil
    // multiply by 10 given that density is given in "Soil bulk density in x 10 kg / m3"

    var soilDensity = ee.Image(ee.Image("OpenLandMap/SOL/SOL_BULKDENS-FINEEARTH_USDA-4A1H_M/v02"));
    var soilTopDensity = soilDensity.select(['b0']).multiply(10);

    // Multiply "soilOrganicCarbonChange" (g of SOC / kg of soil) with "soilDensity" (kg of soil /m3 of soil)
    // "soilOrganicCarbonChange" provides the info of how the concentrations of SOC varied due to land cover change.
    // "soilOrganicCarbonChange" contains both + and - values depending on the land cover change.
    var carbonGrams = soilOrganicCarbonChange.multiply(soilTopDensity);

    // Effectively "carbonGrams" is now g of SOC per m2 (m3 is "a 1x1 square seen from above"), hence we need to multiply by the areas of the pixel.
    // And also divide the result by 1000000 to bring values into Tons of Carbon
    var CarbonTons = carbonGrams.multiply(ee.Image.pixelArea()).divide(1000000);

    // Now we need to introduce the estimates on Social Costs of Carbon (SCC)
    // lets use this publication:
    // William D. Nordhaus, PNAS February 14, 2017 114 (7) 1518-1523;
    // https://www.pnas.org/content/114/7/1518.full#sec-13
    // In table 1 we find the evolution for SCC under a baseline scenrio
    // Scenario - Baseline
    // Years:  2015 2020 2025 2030 2050
    // SCC in USD$/ton CO2: 31.2 37.3 44.0 51.6 102.5

    // Lets use the number of 2025 as example or 44.0 $/Ton CO2
    // Ideally this would nee to be integrated in time
    // Carbon also needs to be converted to CO2 with he 3.66 factor
    var SCC = 44;
    var CarbonSCC = CarbonTons.multiply(SCC).multiply(3.66);

    var regionalCarbonCost = CarbonSCC.reduceRegions(subRegions, ee.Reducer.sum(), 500)

    var updateFeature = function(feature) {
        var SCC = ee.Number(feature.get('sum'));
        return feature.set({'Social Carbon Cost': SCC})
      }
      
    regionalCarbonCost = regionalCarbonCost.map(updateFeature);

    return regionalCarbonCost
}

/*
 * Outputs
 */

exports.LDNIndicatorData = function(startYear, targetYear, subRegions, countryGeometry) {
    var landCoverStartImage = landCoverCollection.filterDate(startYear + '-01-01', startYear + '-12-31').first()
    var landCoverEndImage = landCoverCollection.filterDate(targetYear + '-01-01', targetYear + '-12-31').first()
    var landCoverTransitions = LandCoverTransitions(landCoverStartImage, landCoverEndImage);
    var landCoverChange = LandCoverChangeImage(landCoverTransitions);
    var soilOrganicCarbonChangeRaw = SoilOrganicCarbonChange(landCoverTransitions, soilCarbonTop, startYear, targetYear);
    var soilOrganicCarbonChange = SoilOrganicCarbonChangeClassified(soilOrganicCarbonChangeRaw);
    var regionalLandCoverChange = RegionalScores(landCoverChange, subRegions);
    var regionalLandCoverChangeImage = RegionalScoresImage(regionalLandCoverChange);

    var productivityTrajectoryImageRaw = productivityTrajectory()
    var productivityTrajectoryImage = productivityTrajectoryClassified(productivityTrajectoryImageRaw)
    
    // var outputDataSet = generateLandCoverTypeSummaryFeature(remapLandCoverYear2(landCoverStartImage), startYear, subRegions);
    var outputDataSet = generateLandCoverTypeSummaryFeature(remapLandCoverYear2(landCoverStartImage), startYear, subRegions);
    outputDataSet = generateLandCoverTypeSummaryFeature(remapLandCoverYear2(landCoverEndImage), targetYear, outputDataSet);
    outputDataSet = calculateLandCoverTransitions(landCoverTransitions, targetYear, outputDataSet);
    outputDataSet = RegionalScores(landCoverTransitions, outputDataSet);
    outputDataSet = socialCarbonCost(soilOrganicCarbonChange, outputDataSet)

    var indicatorData = ee.Dictionary({
        'SDG 15.3.1': calculateSDG(landCoverChange, countryGeometry),
        'National Net Change': 2 //calculateNationalNetChange(outputDataSet) //2
    })
    var nationalIndicators = ee.Feature(null).set(targetYear, indicatorData)

    var SDGData = calculateSDG(landCoverChange, countryGeometry);

    return [landCoverChange, soilOrganicCarbonChange, regionalLandCoverChangeImage,
        productivityTrajectoryImage,
        outputDataSet, nationalIndicators, 
        soilOrganicCarbonChangeRaw, productivityTrajectoryImageRaw,
        SDGData
    ]
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

// var landCoverTransitions = LandCoverTransitions(landCoverStartImage, landCoverEndImage);

// var landCoverChange = LandCoverChangeImage(landCoverTransitions);

// var landCover = RegionsOverlay(landCoverChange, regions, subRegions);
// Map.addLayer(landCover,{min: -1, max: 2, palette: ['fc8d59', '#ffffbf', '1a9850', '808080']}, 'Land Cover', true, 0.75);

// var soilOrganicCarbonChange = SoilOrganicCarbonChange(landCoverTransitions, soilCarbonTop);
// var soilOrganicCarbon = RegionsOverlay(soilOrganicCarbonChange, regions, subRegions);
// Map.addLayer(soilOrganicCarbon,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850', '808080']}, 'Soil Organic Carbon', false, 0.75);
// Map.addLayer(soilOrganicCarbonChange,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Soil Organic Carbon Change', false, 0.75);
/**
 * Fire Frequency Analysis Layer
 * @param {Start Year of Analysis} startYear 
 * @param {End Year of Analysis} targetYear 
 */

// Fire Frequency
exports.FireFrequencyAnalysis = function(startYear, targetYear){

    var fireLocations = ee.ImageCollection('ESA/CCI/FireCCI/5_1')
        .select('BurnDate'); // Move to Analysis Layers
    
    fireLocations = fireLocations.filterDate(startYear + '-01-01', targetYear + '-12-31')

    // Function to reclassify burnt date from dasy of year to 1
    // the purpose is to obtaine the yearly frequency of fires
    var Reclassify = function(image) {
        var ClassifiedImage = image.remap(ee.List.sequence(1, 366, 1),// Input
                                        ee.List.repeat(1, 366),  // Output
                                        0,                       // Default value
                                        'BurnDate');
        return ClassifiedImage;
    };
    
    // Reclasifies collection
    var fireOccurances = fireLocations.map(Reclassify);
    // Total fire occurences
    var sum = fireOccurances.reduce(ee.Reducer.sum());
    // Determines fire frequency at pixel level

    // Calculate time range in years
    var years = Number(targetYear) - Number(startYear);

    // sum of fires divided by total of years
    var fireFrequency = sum.divide(years);

    return fireFrequency
}

exports.ErosionRisk = function(startYear, targetYear) {
    // An erosion risk indicator loosly inspired by the methedology as in Fox et all 2006, table 1

    // Fox, D., Berolo, W., Carrega, P., & Darboux, F. (2006). Mapping erosion risk 
    // and selecting sites for simple erosion control measures after a forest fire in 
    // Mediterranean France. Earth Surface Processes and Landforms: The Journal of the
    // British Geomorphological Research Group, 31(5), 606-621.

    // The risk indicator accounts for:
    //1- Slope, 
    //2 - Fire frequencies and 
    //3 - Pre-fire vegetation
    // Then does
    // 4 - integration of the above mentioned factors

    // Loads required data for each sub indicator

    // Read elevation data for 1- Slope
    var dataset = ee.Image('CGIAR/SRTM90_V4');
    var elevation = dataset.select('elevation');

    // Import FireCCI image collection for 2 - Fire frequencies
    var dataset = ee.ImageCollection('ESA/CCI/FireCCI/5_1')
    .select('BurnDate')
    .filterDate(startYear + '-01-01', targetYear + '-12-31');

    // imports most resent 16 day NDVi for 3 - Pre-fire vegetation
    var ndvi = ee.ImageCollection('MODIS/006/MYD13Q1')
                    .select('NDVI').first().divide(10000);
    // the idea is to get the most recent value as indicator
    // shoiuld refer to vegetation condition before the fire


    ////////////////////////////////////////////////Build erosion index:

    // 1 - SLOPE

    // Determine slope from elevation data
    var slope = ee.Terrain.slope(elevation);

    // Logic, higher slope higher the risk
    var slopeCoeffMap = ee.Image(0)
            .where(slope.gte(0).and(slope.lte(5)), 1)//
            .where(slope.gt(5).and(slope.lte(10)), 2)// 
            .where(slope.gt(10).and(slope.lte(20)), 3)// 
            .where(slope.gt(20).and(slope.lte(30)), 4)// 
            .where(slope.gt(30), 5);//5
    var slopeCoef = slopeCoeffMap.updateMask(slopeCoeffMap.gt(0))

    // 2 - Fire

    // Function to reclassify burnt date from dasy of year to 1
    // the purpose is to obtaine the yearly frequency of fires 
    var Reclassify = function(image) {
    var ClassifiedImage = image.remap(ee.List.sequence(1, 366, 1),// Input
                                        ee.List.repeat(1, 366),  // Output
                                        0,                       // Default value
                                        'BurnDate');
    return ClassifiedImage;
    };

    // Reclasifies collection
    var occurenceFire = dataset.map(Reclassify);
    // Total fire occurences
    var sum = occurenceFire.reduce(ee.Reducer.sum());
    // Determines fire frequency at pixel level 
    // Calculate time range in years
    var years = Number(targetYear) - Number(startYear);

    // sum of fires divided by total of years
    var fireFrequency = sum.divide(years);

    // Logic, the higher the frequency the higher the risk
    var fireCoeffMap = ee.Image(0)
            .where(fireFrequency.gt(0).and(fireFrequency.lte(0.05)), 1)//coef 1 
            .where(fireFrequency.gt(0.05).and(fireFrequency.lte(0.10)), 2)// coef 2
            .where(fireFrequency.gt(0.10).and(fireFrequency.lte(0.50)), 3)// coef 3
            .where(fireFrequency.gt(0.50).and(fireFrequency.lte(0.80)), 4)// coef 4
            .where(fireFrequency.gt(0.80), 5);//5

    var fireCoef = fireCoeffMap.updateMask(fireCoeffMap.gt(0));

    // 3 - Pre-fire vegetation

    // Clssification of NDVi in vegetation cerosion classes follwos Aquino et al 2018, table 1
    // Aquino, D. D. N., Rocha Neto, O. C. D., Moreira, M. A., Teixeira, A. D. S., 
    // & Andrade, E. M. D. (2018). Use of remote sensing to identify areas at risk of 
    // degradation in the semi-arid region. Revista Ciência Agronômica, 49(3), 420-429.

    // Logic, the higher the NDVI the lower the risk
    var vegCoeffMap = ee.Image(0)
            .where(ndvi.gt(0).and(fireFrequency.lte(0.2)), 5)//very high
            .where(ndvi.gt(0.2).and(ndvi.lte(0.4)),4)// 
            .where(ndvi.gt(0.4).and(ndvi.lte(0.6)), 3)// 
            .where(ndvi.gt(0.6).and(ndvi.lte(0.8)), 2)// 
            .where(ndvi.gt(0.8), 1);// very low

    var vegCoef = vegCoeffMap.updateMask(vegCoeffMap.gt(0));

    // 4 - Integrating the thhre coefficients

    // Raw sum of index coefficients
    var rawErosionRisk = vegCoef.unmask(0).add(fireCoef.unmask(0)).add(slopeCoef);
    rawErosionRisk = rawErosionRisk.updateMask(rawErosionRisk.gte(8));

    return rawErosionRisk

    // //Check results
    // var Viz = {min: 0, max: 15, palette: ['#ccece6', '#e31a1c']};
    // Map.addLayer(rawErosionRisk,Viz,'erosion risk');
}

exports.DroughtRisk = function() {
    // Reads data on observed meteorology and selects the Palmer Drought Severity Index
    var PDSI = ee.ImageCollection('IDAHO_EPSCOR/TERRACLIMATE')
    .filter(ee.Filter.date('1980-01-01', '2019-01-01'))
    .select('pdsi');
    // the start date of the selection should NOT be dynamically selected by the user because
    // long-term climatology only make sense for 30 or more. The end date should always reflect
    // the current time so that its always up to date.

    // Long term annual PDSI
    var LongTermPDSI = PDSI.mean().multiply(0.01);

    // PDSI for each year 
    // List sequence of years for which mean PDSI are to be determined
    var Years = ee.List.sequence(1990, 2019);// the end date should reflect current year 

    // Function to determine annual PDSI index
    var PDSIbyYear = ee.ImageCollection.fromImages(
    Years.map(function(y) {
    return PDSI.filter(ee.Filter.calendarRange(y, y, 'year'))
    //.filter(ee.Filter.calendarRange(m, m, 'month'))
    .mean()//.multiply(0.01)
    .set('year', y);
    }).flatten());

    // Select PDSI for current year
    var CurrentYearPDSI = PDSIbyYear.first().multiply(0.01);

    // OPTION
    // Set the Palmer index into severity classes following the classification
    // adopted in http://agron-www.agron.iastate.edu/courses/Agron541/classes/541/lesson04a/4a.4.html

    //4.00 or more	Extremely wet
    //3.00 to 3.99	Very wet
    //2.00 to 2.99	Moderately wet
    //1.00 to 1.99	Slightly wet
    //0.50 to 0.99	Incipient wet spell
    //0.49 to -0.49	Near normal
    //-0.50 to -0.99	Incipient dry spell
    //-1.00 to -1.99	Mild drought
    //-2.00 to -2.99	Moderate drought
    //-3.00 to -3.99	Severe drought
    //-4.00 or less	Extreme drought

    // Remaps the PSDI values
    var LongTermPDSIRemaped = ee.Image(99)
             .where(LongTermPDSI.gte(4), 1)//Extremely wet
            .where(LongTermPDSI.gte(3).and(LongTermPDSI.lte(3.99)), 2)
            .where(LongTermPDSI.gte(2).and(LongTermPDSI.lte(2.99)), 3)
             .where(LongTermPDSI.gte(1).and(LongTermPDSI.lte(1.99)),4)
             .where(LongTermPDSI.gte(0.5).and(LongTermPDSI.lte(0.99)), 5)          
             .where(LongTermPDSI.lte(0.49).and(LongTermPDSI.gte(-0.49)), 6)            
             .where(LongTermPDSI.lte(-0.5).and(LongTermPDSI.gte(-0.99)), 7)             
             .where(LongTermPDSI.lte(-1).and(LongTermPDSI.gte(-1.99)), 8)            
             .where(LongTermPDSI.lte(-2).and(LongTermPDSI.gte(-2.99)), 9)
             .where(LongTermPDSI.lte(-3).and(LongTermPDSI.gte(-3.99)), 10)
             .where(LongTermPDSI.lte(-4), 11);

    var PDSILongTermIndex= LongTermPDSIRemaped.updateMask(LongTermPDSIRemaped.lt(99))

    // //Color palette
    // var Viz = {min: 4,max: -4, palette: ['#35978f', '#8c510a'],};

    // // View results
    // Map.addLayer(LongTermPDSI, Viz,'Long Term PDSI');
    // Map.addLayer(CurrentYearPDSI, Viz,'Current Year PDSI');

    return [CurrentYearPDSI, LongTermPDSI, LongTermPDSIRemaped]

}

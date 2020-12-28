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
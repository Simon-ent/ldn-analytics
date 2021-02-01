/*
*   Helper Functions
*/

exports.RegionsOverlay = function(baseImage, regions, subRegions) {
    var output = baseImage.paint({
        featureCollection: subRegions, 
        color: 4, 
        width: 1
    }).paint({
        featureCollection: regions, 
        color: 4, 
        width: 2
    });
    return output
}

exports.highlightRegion = function(region) {
    var empty = ee.Image().byte();
    var regionBoundary = empty.paint({
        featureCollection: region,
        color: 18,
        width: 2,
    });
    return regionBoundary
}

// exports.extractLandCoverChartData = function(feature) {
//     return ee.Feature(null, {
//         'Year': feature.get('Year'),
//         'Target': feature.get('Target'),
//         'Tree_Cover': feature.get('Tree_Cover'),
//         'Grasslands': feature.get('Grasslands'),
//         'Croplands': feature.get('Croplands'),
//         'Wetlands': feature.get('Wetlands'),
//         'Artificial': feature.get('Artificial'),
//         'Bare_Land': feature.get('Bare_Land'),
//         'Water_Bodies': feature.get('Water_Bodies'),
//     })
// }

// // ee.Feature.copyProperties(source, properties, exclude) could use instead
// exports.extractLandCoverTransitionsChartData = function(feature, seriesName) {
//     return ee.Feature(null, {
//         'Series_Name': seriesName,
//         'Tree_Cover to Grasslands': feature.get('Tree_Cover to Grasslands'),
//         'Tree_Cover to Croplands': feature.get('Tree_Cover to Croplands'),
//         'Tree_Cover to Artificial': feature.get('Tree_Cover to Artificial'),
//         'Grasslands to Croplands': feature.get('Grasslands to Croplands'),
//         'Grasslands to Artificial': feature.get('Grasslands to Artificial'),
//         'Bare_Land to Grasslands': feature.get('Bare_Land to Grasslands'),
//         'Bare_Land to Croplands': feature.get('Bare_Land to Croplands'),
//         'Bare_Land to Artificial': feature.get('Bare_Land to Artificial')
//     })
// }
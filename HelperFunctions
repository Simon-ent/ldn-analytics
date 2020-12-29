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
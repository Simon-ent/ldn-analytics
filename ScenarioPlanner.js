/*
*   Functions for the scenario planning
*/

exports.createScenario = function(regionalData, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    
    // createLandCoverScenario(regionalData, scenarioBaseName, scenarioName)
    var updatedScenarioData = regionalData.map(function(feature) {
        var landCoverData = ee.Dictionary(feature.get('landCover'));
        var landCoverTransitionsData = ee.Dictionary(feature.get('landCoverTransitions'));
        var scenarioBaseName = '2019';

        var landCoverTypeCount = landCoverData.get(scenarioBaseName);
        var landCoverTransitions = landCoverTransitionsData.get(scenarioBaseName);

        landCoverData = landCoverData.set(scenarioName, landCoverTypeCount)
        landCoverTransitionsData = landCoverTransitionsData.set(scenarioName, landCoverTransitions)
        return feature.set('landCover', landCoverData, 'landCoverTransitions', landCoverTransitionsData)
    })
    return updatedScenarioData
}

exports.saveScenario = function(regionalData, scenarioLandCoverTransitions, currentRegionText, scenarioName) {
    var allRegionsExcludingCurrentRegion = ee.FeatureCollection(regionalData).filter(ee.Filter.eq('ADM2_NAME', currentRegionText).not())
    var currentRegion = ee.FeatureCollection(regionalData).filter(ee.Filter.eq('ADM2_NAME', currentRegionText)).first()
    print(currentRegion)
    var landCoverTransitionsData = ee.Dictionary(currentRegion.get('landCoverTransitions'));
    print(landCoverTransitionsData)
    var updatedLandCoverTransitions = landCoverTransitionsData.set(scenarioName, scenarioLandCoverTransitions)
    currentRegion = currentRegion.set('landCoverTransitions', updatedLandCoverTransitions)

    var updatedRegionalData = allRegionsExcludingCurrentRegion.merge(ee.FeatureCollection([currentRegion]))
    print("Updated Data: ", updatedRegionalData)

    return updatedRegionalData
}

// exports.createScenario = function(scenarioCollection, scenarioBaseName, scenarioName) {
//     // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
//     // Returns the collection of scenarios plus the new scenario
//     var scenario = scenarioCollection.filter(ee.Filter.eq('id', scenarioBaseName)).first()
//     scenario = scenario.set({id: scenarioName});
//     return scenarioCollection.merge(ee.FeatureCollection([scenario]));
// }
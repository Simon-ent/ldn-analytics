/*
*   Functions for the scenario planning
*/

exports.createScenario = function(regionalData, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    
    // createLandCoverScenario(regionalData, scenarioBaseName, scenarioName)
    var updatedScenarioData = regionalData.map(function(feature) {
        var landCoverData = ee.Dictionary(feature.get('landCover'));
        var landCoverTransistionsData = ee.Dictionary(feature.get('landCoverTransistions'));
        var scenarioBaseName = '2019';

        var landCoverTypeCount = landCoverData.get(scenarioBaseName);
        var landCoverTransitions = landCoverTransistionsData.get(scenarioBaseName);

        landCoverData = landCoverData.set(ee.String(scenarioName + '_2019'), landCoverTypeCount)
        landCoverTransistionsData = landCoverTransistionsData.set(ee.String(scenarioName + '_2019'), landCoverTransitions)
        return feature.set('landCover', landCoverData, 'landCoverTransitions', landCoverTransistionsData)
    })
    return updatedScenarioData
}

// exports.createScenario = function(scenarioCollection, scenarioBaseName, scenarioName) {
//     // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
//     // Returns the collection of scenarios plus the new scenario
//     var scenario = scenarioCollection.filter(ee.Filter.eq('id', scenarioBaseName)).first()
//     scenario = scenario.set({id: scenarioName});
//     return scenarioCollection.merge(ee.FeatureCollection([scenario]));
// }
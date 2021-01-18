/*
*   Functions for the scenario planning
*/

exports.createScenario = function(regionalData, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    
    // createLandCoverScenario(regionalData, scenarioBaseName, scenarioName)
    var updatedScenarioData = regionalData.map(function(feature) {
        var landCoverTypeCount = feature.get('2019')
        var landCoverTransitions = feature.get('landCoverTransitions')
        return feature.set(ee.String(scenarioName + '_2019'), landCoverTypeCount, ee.String(scenarioName), landCoverTransitions)
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
/*
*   Functions for the scenario planning
*/

exports.createScenario = function(scenarioCollection, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    var scenario = scenarioCollection.filter(ee.Filter.eq('id', scenarioBaseName)).first()
    scenario = scenario.set({id: scenarioName});
    return scenarioCollection.merge(ee.FeatureCollection([scenario]));
}
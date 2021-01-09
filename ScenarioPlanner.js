/*
*   Functions for the scenario planning
*/

exports.createScenario = function(scenarioCollection, scenarioBase, scenarioName) {
    print(scenarioCollection, scenarioBase, scenarioName);
    var base = scenarioCollection.filter(ee.Filter.eq('id', 'scenarioBase')).first()
    print(base);
    base.set({id: scenarioName});

    var updatedScenarioCollection = scenarioCollection.merge(ee.FeatureCollection([base]));
    
    return updatedScenarioCollection
}
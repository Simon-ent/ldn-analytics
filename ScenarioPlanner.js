/*
*   Functions for the scenario planning
*/

const { LandCoverTransistions } = require("../GEO_LDN_APP/ImageFunctions")

function addScenarioData(feature, scenarioBaseName)

function createLandCoverScenario(regionalData, scenarioBaseName, scenarioName) {
    if (scenarioBaseName == 'predictions') {
        
    }
}

exports.createScenario = function(regionalData, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    
    // createLandCoverScenario(regionalData, scenarioBaseName, scenarioName)
    var updatedScenarioData = regionalData.map(function(feature) {
        var landCoverTypeCount = feature.get('2019')
        var landCoverTransitions = feature.get('landCoverTransitions')
        return feature.set(ee.String(scenarioBaseName + '_2019'), landCoverTypeCount, ee.String(scenarioBaseName), landCoverTransitions)
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
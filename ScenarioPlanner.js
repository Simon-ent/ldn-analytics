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

exports.saveScenario = function(regionalData, scenarioLandCoverTransitions, currentRegionText, scenarioName, startYear) {
    var allRegionsExcludingCurrentRegion = ee.FeatureCollection(regionalData).filter(ee.Filter.eq('ADM2_NAME', currentRegionText).not())
    var currentRegion = ee.FeatureCollection(regionalData).filter(ee.Filter.eq('ADM2_NAME', currentRegionText)).first()
    // Transitions
    var landCoverTransitionsData = ee.Dictionary(currentRegion.get('landCoverTransitions'));
    var updatedLandCoverTransitions = landCoverTransitionsData.set(scenarioName, scenarioLandCoverTransitions)
    currentRegion = currentRegion.set('landCoverTransitions', updatedLandCoverTransitions)
    // LandCover
    var landCoverBaseData = ee.Dictionary(currentRegion.get('landCover')).get(startYear);

    landCoverBaseData.evaluate(function(data) {
        print(data)
        print(scenarioLandCoverTransitions['Tree_Cover to Artificial'])
        var artificial = ee.Number(data['Artificial'])
            .add(scenarioLandCoverTransitions['Tree_Cover to Artificial'])
            // .add(scenarioLandCoverTransitions['Grasslands to Artificial'])
            // .add(scenarioLandCoverTransitions['Bare_Land to Artificial']);
        var bareLand = ee.Number(data['Bare_land'])
            .add(ee.Number(scenarioLandCoverTransitions['Bare_Land to Grasslands']).multiply(-1))
            // .add(ee.Number(scenarioLandCoverTransitions['Bare_Land to Croplands']).multiply(-1))
            // .add(ee.Number(scenarioLandCoverTransitions['Bare_Land to Artificial']).multiply(-1));
        var croplands = ee.Number(data['Croplands']);
        var grasslands = ee.Number(data['Grasslands']);
        var treeCover = ee.Number(data['Tree_Cover']);
        var waterBodies = ee.Number(data['Water_Bodies']);
        var wetlands = ee.Number(data['Wetlands']);

        print('Land Cover:', artificial, bareLand, croplands)

    })

    var updatedRegionalData = allRegionsExcludingCurrentRegion.merge(ee.FeatureCollection([currentRegion]))

    return updatedRegionalData
}

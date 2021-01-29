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
    var landCoverData = ee.Dictionary(currentRegion.get('landCover'))
    var landCoverBaseData = landCoverData.get(startYear);

    // print(landCoverBaseData)
    // print(scenarioLandCoverTransitions)
    // print(scenarioLandCoverTransitions['Tree_Cover to Artificial'])
    // var artificial = parseFloat(landCoverBaseData['Artificial']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']);
    // var bareLand = parseFloat(landCoverBaseData['Bare_land']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']);
    // var croplands = parseFloat(landCoverBaseData['Croplands']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']);
    // var grasslands = parseFloat(landCoverBaseData['Grasslands']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']);
    // var treeCover = parseFloat(landCoverBaseData['Tree_Cover']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']);
    // var waterBodies = parseFloat(landCoverBaseData['Water_Bodies']);
    // var wetlands = parseFloat(landCoverBaseData['Wetlands']);

    // var updatedLandCover = {
    //     Artificial: artificial,
    //     Bare_Land: bareLand,
    //     Croplands: croplands,
    //     Grasslands: grasslands,
    //     Tree_Cover: treeCover,
    //     Water_Bodies: waterBodies,
    //     Wetlands: wetlands
    // }

    // print('Land Cover:', updatedLandCover)

    // var updatedLandCoverData = landCoverData.set(scenarioName, updatedLandCover)

    // currentRegion = currentRegion.set('landCover', updatedLandCoverData)

    var currentRegionLandCover = landCoverBaseData.evaluate(function(data) {
        print(data)
        print(scenarioLandCoverTransitions)
        print(scenarioLandCoverTransitions['Tree_Cover to Artificial'])
        // var artificial = data['Artificial'] + scenarioLandCoverTransitions['Tree_Cover to Artificial'] + scenarioLandCoverTransitions['Grasslands to Artificial'] + scenarioLandCoverTransitions['Bare_Land to Artificial'];
        // var bareLand = data['Bare_land'] - scenarioLandCoverTransitions['Bare_Land to Grasslands'] - scenarioLandCoverTransitions['Bare_Land to Croplands'] - scenarioLandCoverTransitions['Bare_Land to Artificial'];
        // var croplands = data['Croplands'] + scenarioLandCoverTransitions['Bare_Land to Croplands'] + scenarioLandCoverTransitions['Grasslands to Croplands'] + scenarioLandCoverTransitions['Tree_Cover to Croplands'];
        // var grasslands = data['Grasslands'] + scenarioLandCoverTransitions['Bare_Land to Grasslands'] + scenarioLandCoverTransitions['Tree_Cover to Grasslands'] - scenarioLandCoverTransitions['Grasslands to Artificial'] - scenarioLandCoverTransitions['Grasslands to Croplands'];
        // var treeCover = data['Tree_Cover'] - scenarioLandCoverTransitions['Tree_Cover to Artificial'] - scenarioLandCoverTransitions['Tree_Cover to Croplands'] - scenarioLandCoverTransitions['Tree_Cover to Grasslands'];
        // var waterBodies = data['Water_Bodies'];
        // var wetlands = data['Wetlands'];

        var artificial = parseFloat(data['Artificial']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']);
        var bareLand = parseFloat(data['Bare_Land']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']);
        var croplands = parseFloat(data['Croplands']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']);
        var grasslands = parseFloat(data['Grasslands']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']);
        var treeCover = parseFloat(data['Tree_Cover']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']);
        var waterBodies = parseFloat(data['Water_Bodies']);
        var wetlands = parseFloat(data['Wetlands']);

        var updatedLandCover = {
            Artificial: artificial,
            Bare_Land: bareLand,
            Croplands: croplands,
            Grasslands: grasslands,
            Tree_Cover: treeCover,
            Water_Bodies: waterBodies,
            Wetlands: wetlands
        }

        print('Land Cover:', updatedLandCover)

        var updatedLandCoverData = landCoverData.set(scenarioName, updatedLandCover)

        // var currentRegionLandCover = currentRegion.set('landCover', updatedLandCoverData)
        return currentRegion.set('landCover', updatedLandCoverData)

        // var updatedRegionalData = allRegionsExcludingCurrentRegion.merge(ee.FeatureCollection([currentRegion]))

        // return updatedRegionalData
    })

    var updatedRegionalData = allRegionsExcludingCurrentRegion.merge(ee.FeatureCollection([currentRegionLandCover]))

    return updatedRegionalData
}

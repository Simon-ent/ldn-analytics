/*
*   Functions for the scenario planning
*/

exports.createScenario = function(regionalData, scenarioBaseName, scenarioName) {
    // Takes a collection of scenarios and creates a new scenario with the name: scenarioName.
    // Returns the collection of scenarios plus the new scenario
    
    var updatedScenarioData = regionalData.map(function(feature) {
        var landCoverData = ee.Dictionary(feature.get('landCover'));
        var landCoverTransitionsData = ee.Dictionary(feature.get('landCoverTransitions'));

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
    
    // LandCover
    var landCoverData = ee.Dictionary(currentRegion.get('landCover'))
    var landCoverBaseData = ee.Dictionary(landCoverData.get(startYear));

    var artificial = landCoverBaseData.getNumber('Artificial').add(parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) + parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']));
    var bareLand = landCoverBaseData.getNumber('Bare_Land').add(parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) - parseFloat(scenarioLandCoverTransitions['Bare_Land to Artificial']));
    var croplands = landCoverBaseData.getNumber('Croplands').add(parseFloat(scenarioLandCoverTransitions['Bare_Land to Croplands']) + parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']));
    var grasslands = landCoverBaseData.getNumber('Grasslands').add(parseFloat(scenarioLandCoverTransitions['Bare_Land to Grasslands']) + parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Artificial']) - parseFloat(scenarioLandCoverTransitions['Grasslands to Croplands']));
    var treeCover = landCoverBaseData.getNumber('Tree_Cover').add(parseFloat(scenarioLandCoverTransitions['Tree_Cover to Artificial']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Croplands']) - parseFloat(scenarioLandCoverTransitions['Tree_Cover to Grasslands']));
    var waterBodies = landCoverBaseData.getNumber('Water_Bodies');
    var wetlands = landCoverBaseData.getNumber('Wetlands');

    var updatedLandCover = {
        Artificial: artificial,
        Bare_Land: bareLand,
        Croplands: croplands,
        Grasslands: grasslands,
        Tree_Cover: treeCover,
        Water_Bodies: waterBodies,
        Wetlands: wetlands
    }

    var updatedLandCoverData = landCoverData.set(scenarioName, updatedLandCover);

    currentRegion = currentRegion.set('landCoverTransitions', updatedLandCoverTransitions);
    currentRegion = currentRegion.set('landCover', updatedLandCoverData);

    return allRegionsExcludingCurrentRegion.merge(ee.FeatureCollection([currentRegion]))
}

/**
 * Load Datasets
 */
var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
var worldRegions = ee.FeatureCollection("FAO/GAUL/2015/level1");
var worldSubRegions = ee.FeatureCollection("FAO/GAUL/2015/level2");

/* 
 *   Function Imports
 */
var LDNIndicatorFunctions = require('users/ee-simon-ent/geo-ldn-app:LDNIndicatorFunctions.js');
var HelperFunctions = require('users/ee-simon-ent/geo-ldn-app:HelperFunctions.js');
var AnalysisLayers = require('users/ee-simon-ent/geo-ldn-app:AnalysisLayers.js');
var ScenarioFunctions = require('users/ee-simon-ent/geo-ldn-app:ScenarioPlanner.js');
var Styles = require('users/ee-simon-ent/geo-ldn-app:Styles.js');
var UserInterface = require('users/ee-simon-ent/geo-ldn-app:UserInterface.js')

/**
 * Constants & Variables
 */
var app = {
    setup: {
        country: 'Ghana',
        startYear: '2009',
        targetYear: '2019',
    },
    datasets: {
        regions: null,
        subRegions: null,
        regionalData: null,
        nationalIndicators: null,
    },
    images: {},
    variables: {
        region: null,
        regionNameText: null,
        scenarioList: null,
        transitionsList: null,
        currentScenario: null,
    }
};

/**
 * Functions
 */

function Label(text) {
    var output = ui.Label({
        value: text,
        style: Styles.TEXT_STYLE
    })
    return output
}

function IndicatorLabel(text) {
    var output = ui.Label({
        value: text,
        style: Styles.INDICATOR_STYLE
    })
    return output
}

// Updates the map overlay using the currently-selected region.
function updateOverlay() {
    var region = app.variables.region;
    var regionHighlight = ui.Map.Layer(HelperFunctions.highlightRegion(region), {palette: ['8856a7']}, 'Selected Region');
    mapPanel.layers().set(5, regionHighlight);
}

function handleMapClick(location) {
    var selectedPoint = [location.lon, location.lat];
    var region = app.datasets.subRegions.filterBounds(ee.Geometry.MultiPoint(selectedPoint));
    app.variables.region = region;
    updateOverlay();
    updateUI();
}

function regionalChartsBuilder() {
    regionalChartsPanel.clear()
    var regionNameText = app.variables.regionNameText;
    print(regionNameText)
    print("Regional Data:", app.datasets.regionalData)
    var currentRegion = ee.FeatureCollection(app.datasets.regionalData).filter(ee.Filter.eq('ADM2_NAME', regionNameText)).first()
    print(currentRegion)

    // Summary Table
    var subRegions = app.datasets.subRegions;
    var regionLandCoverImage = app.images.landCover;
    var regionSoilOrganicCarbon = app.images.soilOrganicCarbon;
    var regionProductivity = app.images.productivity;

    var landCoverHistogram = regionLandCoverImage.reduceRegion({
        reducer: ee.Reducer.fixedHistogram(-1,2,3),
        geometry: subRegions.filter(ee.Filter.eq('ADM2_NAME', regionNameText)),
        scale: 500,
        maxPixels: 1e9
    });
    // print(landCoverHistogram)
    var LCArray = ee.Array(landCoverHistogram.get('remapped'));

    var SOCHistogram = regionSoilOrganicCarbon.reduceRegion({
        reducer: ee.Reducer.fixedHistogram(-1,2,3),
        geometry: subRegions.filter(ee.Filter.eq('ADM2_NAME', regionNameText)),
        scale: 500,
        maxPixels: 1e9
    });
    var SOCArray = ee.Array(SOCHistogram.get('constant'));

    var ProductivityHistogram = regionProductivity.reduceRegion({
        reducer: ee.Reducer.fixedHistogram(-1,2,3),
        geometry: subRegions.filter(ee.Filter.eq('ADM2_NAME', regionNameText)),
        scale: 500,
        maxPixels: 1e9
    });
    var ProductivityArray = ee.Array(ProductivityHistogram.get('constant'));

    var summaryTableData = ee.Array.cat([ProductivityArray.slice(1, 1), SOCArray.slice(1,1), LCArray.slice(1,1)], 1)
    // print(chartData)
    var labels = ['Degrading', 'Stable', 'Improving']
    var summaryTable = ui.Chart.array.values(summaryTableData, 1, ["Productivity", "Soil Organic Carbon", 'Land Cover'])
        .setSeriesNames(labels)
        .setChartType('Table')
    regionalChartsPanel.add(summaryTable)

    // Land Cover
    var landCoverData = ee.Dictionary(currentRegion.get('landCover'));
    var landCoverTransitionsData = ee.Dictionary(currentRegion.get('landCoverTransitions'));

    var scenarioList = ee.List(app.variables.scenarioList);

    var landCoverChartData = scenarioList.map(function(item) {
        return ee.Dictionary(landCoverData.get(item)).values()
    })

    // Land Cover Over Time Chart
    var landTypesScenarioChart = ui.Chart.array.values(landCoverChartData, 1, ee.Dictionary(landCoverData.get(scenarioList.get(0))).keys())
        .setSeriesNames(scenarioList)
        .setChartType('ColumnChart')
        .setOptions({
            title: 'Land Types by Year',
            vAxis: {title: 'Land Type'},
            hAxis: {title: 'Pixel Count', logScale: true},
            colors: [
                '696969', '377eb8', '4daf4a', '984ea3', 'ff7f00',
                'ffff33', 'a65628', 'f781bf', 'e41a1c'],
            bar: { gap: 0 },
            orientation: 'vertical',
        });

    regionalChartsPanel.add(landTypesScenarioChart)

    // Transitions Chart
    var transitionsList = ee.List(app.variables.transitionsList);
    var landCoverTransitionsChartData = transitionsList.map(function(item) {
        return ee.Dictionary(landCoverTransitionsData.get(item)).values()
    })

    var landCoverTransitionsChart = ui.Chart.array.values(landCoverTransitionsChartData, 1, ee.Dictionary(landCoverTransitionsData.get(transitionsList.get(0))).keys())
        .setSeriesNames(transitionsList)
        .setChartType('ColumnChart')
        .setOptions({
            title: 'Land Cover Transitions',
            hAxis: {title: 'Net Change'},
            colors: [
                '377eb8', '4daf4a', '984ea3', 'ff7f00',
                'ffff33', 'a65628', 'f781bf', 'e41a1c'],
            orientation: 'vertical',
        });

    regionalChartsPanel.add(landCoverTransitionsChart)
    
    // regionalChartsPanel.add(Label('Social Cost of Carbon ($)'))
    // currentRegion.get('Social Carbon Cost').evaluate(function(result){
    //   regionalChartsPanel.add(IndicatorLabel(result))
    // });
}

function loadCountry(country, startYear, targetYear) {
    countryName.setValue(country);
    mapPanel.clear()
    var countryGeometry = countries.filter(ee.Filter.eq('ADM0_NAME', country));
    var regions = worldRegions.filter(ee.Filter.eq('ADM0_NAME', country));
    var subRegions = worldSubRegions.filter(ee.Filter.eq('ADM0_NAME', country));
    // app.datasets.countryGeometry = countryGeometry;
    app.datasets.regions = regions;
    app.datasets.subRegions = subRegions;
    app.variables.scenarioList = [startYear, targetYear]; // Needs improving
    app.variables.transitionsList = [targetYear]; // Needs improving

    /**
     * LDN Indicators
     */

    var LDNIndicatorData = LDNIndicatorFunctions.LDNIndicatorData(startYear, targetYear, subRegions, countryGeometry)

    // Data
    app.datasets.regionalData = LDNIndicatorData[4];
    app.datasets.nationalIndicators = LDNIndicatorData[5];
    LDNIndicatorData[8].evaluate(function(SDGData) {
        SDGValue.setValue(SDGData + ' %')
        app.variables.SDGValue = SDGData
    })

    // Land Cover (Layer 0)
    var landCoverChange = LDNIndicatorData[0].clip(countryGeometry);
    app.images.landCover = landCoverChange;
    mapPanel.addLayer(landCoverChange,{min: -1, max: 1, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Land Cover', false, 0.75);

    // Regional Land Cover Tiles (Layer 1)
    // Thoughts on -1 to 1 vs -0.2 to 0.2, the latter makes all changes much more easily identified?
    var regionalLandCoverChange = LDNIndicatorData[2].clip(countryGeometry);
    mapPanel.addLayer(regionalLandCoverChange,{min: -0.20, max: 0.20, palette: ['fc8d59', 'ffffbf', '1a9850']}, 'Regional Degredation', true, 0.9)

    // Soil Organic Carbon (Layer 2)
    var soilOrganicCarbonChange = LDNIndicatorData[1].clip(countryGeometry);
    app.images.soilOrganicCarbon = soilOrganicCarbonChange;
    mapPanel.addLayer(soilOrganicCarbonChange,{min: -1, max: 1, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Soil Organic Carbon Change', false, 0.75);

    // Productivity Trajectory (Layer 3)
    var productivityTrajectoryImage = LDNIndicatorData[3].clip(countryGeometry);
    app.images.productivity = productivityTrajectoryImage;
    mapPanel.addLayer(productivityTrajectoryImage, {min: -1, max: 1, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Productivity Trajectory', false, 0.75)

    // Regional Outlines (Layer 4)
    mapPanel.addLayer(HelperFunctions.RegionsOverlay(ee.Image().byte(), regions, subRegions), {palette:['808080']}, 'Regions', true, 0.85);

    // Selected Region Outline (Layer 5)
    mapPanel.addLayer(
        HelperFunctions.highlightRegion(
            app.datasets.regions.filter(
                ee.Filter.eq('ADM2_NAME', app.variables.region)
            )
        ), {palette: ['8856a7']}, 
    'Selected Region');

    /**
     * Analysis Layers
     */

    // Fire Frequency (Layer 6)
    var fireFrequency = AnalysisLayers.FireFrequencyAnalysis(startYear, targetYear).clip(countryGeometry);
    mapPanel.addLayer(fireFrequency, {min: 0, max: 1, palette: ['#ffeda0', '#de2d26']}, 'Fire Frequency', false, 0.5);

    // Erosion Risk (Layer 7)
    var erosionRisk = AnalysisLayers.ErosionRisk(startYear, targetYear).clip(countryGeometry);
    mapPanel.addLayer(erosionRisk, {min: 0, max: 15, palette: ['#ccece6', '#e31a1c']}, 'Erosion Risk', false, 0.75);

    // Drought Risk (Layer 8,9,10)
    var droughtRisk = AnalysisLayers.DroughtRisk();
    var currentDroughtRisk = droughtRisk[0].clip(countryGeometry);
    var longTermDroughtRisk = droughtRisk[1].clip(countryGeometry);
    // var longTermDroughtRiskClassified = droughtRisk[2].clip(countryGeometry);
    var droughtRiskPalette = {min: 4,max: -4, palette: ['#35978f', '#8c510a']};

    mapPanel.addLayer(currentDroughtRisk, droughtRiskPalette, 'Current Drought Risk', false, 0.9);
    mapPanel.addLayer(longTermDroughtRisk, droughtRiskPalette, 'Long Term Drought Risk', false, 0.9);
    // mapPanel.addLayer(longTermDroughtRiskClassified, droughtRiskPalette, 'Classified Long Term Drought Risk', false, 0.9);

    // // Wildlife Corridors (Layer 11)
    // var WDPA = ee.FeatureCollection('WCMC/WDPA/current/polygons');
    // var WDPAParams = {
    // palette: ['2ed033', '5aff05', '67b9ff', '5844ff', '0a7618', '2c05ff'],
    // min: 0.0,
    // max: 1550000.0,
    // opacity: 0.8,
    // };
    // var WDPAimage = ee.Image().float().paint(WDPA, 'REP_AREA');
    // mapPanel.addLayer(WDPAimage.clip(countryGeometry), WDPAParams, 'WCMC/WDPA/current/polygons',false);
    // mapPanel.addLayer(WDPA, null, 'for Inspector', false);

    mapPanel.centerObject(countryGeometry);
    mapPanel.onClick(handleMapClick);
}

function updateUI() {
    introPanel2.style().set('shown', false);
    countryPanel.style().set('shown', true);
    var region = app.variables.region;
    var regionNameText = region.first().get('ADM2_NAME').getInfo();
    regionName.setValue(regionNameText);
    app.variables.regionNameText = regionNameText;
    regionalChartsBuilder();
    updateScenarioUIList();
    // createIndicatorsChart();
}

/**
 * Base UI
 */
ui.root.clear()
var mapPanel = ui.Map()
var uiPanel = ui.Panel({style: {width: '500px', padding: '10px'}});
var splitPanel = ui.SplitPanel(mapPanel, uiPanel);

function landingPageStart() {
    ui.root.widgets().set(0, splitPanel);
    loadCountry(app.setup.country, app.setup.startYear, app.setup.targetYear);
}

function returnToMapView() {
    ui.root.widgets().set(0, splitPanel);
}

var landingPage = UserInterface.generateLandingPage(app, false, landingPageStart, returnToMapView)
ui.root.add(landingPage)

/**
 * Intro Panel 2 to select region
 */

var introPanel2 = ui.Panel({style: {stretch: 'horizontal', shown: true}});
uiPanel.add(introPanel2);

introPanel2.add(ui.Label({
    value: app.setup.country,
    style: Styles.HEADER_STYLE_1
}))

introPanel2.add(ui.Label({
    value: 'Please click on a region on the map to begin analysis.',
    style: Styles.INTRO_STYLE
}))


/**
 * Country Panel
 */

var countryPanel = ui.Panel({style: {stretch: 'horizontal', shown: false}});
uiPanel.add(countryPanel);

var countryName = ui.Label({
    value: 'Loading...',
    style: Styles.HEADER_STYLE_1
});

var SDGValue = ui.Label({ value: 'Loading...', style: {fontWeight: 'bold', fontSize: '20px', margin: '0 8px 0 auto'}})

countryPanel.add(ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'horizontal'},
    widgets: [
        countryName,
        ui.Panel({
            layout: ui.Panel.Layout.flow('vertical'),
            style: {margin: '0 0 0 auto'},
            widgets: [
                SDGValue,
                ui.Label({
                    value: 'SDG 15.3.1',
                    style: {fontWeight: 'lighter'}
                })
            ]
        })
    ]
}))

// Regional Data
var regionalDataPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
});
countryPanel.add(regionalDataPanel);

var regionName = ui.Label('', Styles.HEADER_STYLE_2);

// Edit Panel
var regionalEditPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
        shown: false
    }
});
regionalDataPanel.add(regionalEditPanel);

regionalDataPanel.add(
    ui.Panel([
        regionName, 
        // regionalDataEditButton
        ],
        ui.Panel.Layout.flow('horizontal'),
        {stretch: 'vertical'}
    )
);

// Charts
var regionalChartsPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
});
regionalDataPanel.add(regionalChartsPanel);

// Scenario Panel
// For the Scenario Edit UI please see the scenario section

var scenarioPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
});
countryPanel.add(scenarioPanel);

scenarioPanel.add(ui.Label({
    value: 'Scenarios',
    style: Styles.HEADER_STYLE_2,
}));

// Scenarios Explanation Instructions
var addSceanrioInstructions = ui.Panel({style: {stretch: 'horizontal', shown: true}});
scenarioPanel.add(addSceanrioInstructions);

addSceanrioInstructions.add(ui.Label({
    value: 'Add a scenario based off the Start and Target Year selected, to model different changes required to acheive LDN.',
    style: Styles.HELP_STYLE
}))

var scenarioListPanel = ui.Panel()
scenarioPanel.add(scenarioListPanel)

function updateScenarioUIList() {
    scenarioListPanel.clear()
    app.variables.transitionsList.forEach(function(scenario) {
        if (scenario == app.setup.targetYear) {
            // Do nothing
        } else {
            scenarioListPanel.add(ui.Panel({
                layout: ui.Panel.Layout.flow('horizontal'),
                style: {stretch: 'horizontal'},
                widgets: [
                    ui.Label({
                        value: scenario,
                        style: {margin: '8px', padding: '6px 0 0 0'}
                    }),
                    ui.Panel({
                        layout: ui.Panel.Layout.flow('horizontal'),
                        style: {margin: '0 8px 0 auto'},
                        widgets: [
                            ui.Button({
                                label: 'Edit',
                                onClick: function () {
                                    var landTypesScenarioChart = regionalChartsPanel.widgets().get(1);
                                    landTypesScenarioChart.setChartType('Table')
                                    var transitionsChart = regionalChartsPanel.widgets().get(2);
                                    transitionsChart.setChartType('Table')
                                    setRegionalEditData(scenario)
                                    regionalEditPanel.style().set('shown', true);
                                    scenarioPanel.style().set('shown', false);
                                    settingsPanel.style().set('shown', false);
                                }
                            }),
                            ui.Button({
                                label: 'Delete',
                                onClick: function () {
                                    // Soft delete doesn't change the feature
                                    app.variables.transitionsList = app.variables.transitionsList.filter(function(item) {return item != scenario});
                                    app.variables.scenarioList = app.variables.scenarioList.filter(function(item) {return item != scenario});
                                    updateScenarioUIList()
                                    regionalChartsBuilder()
                                }
                            })
                        ]
                    })
                ]
            }));
        }
    });
}

var createScenarioButton = ui.Button({
    label: 'Create Scenario',
    onClick: function () {
        countryPanel.style().set('shown', false)
        createScenarioPanel.style().set('shown', true)
        updateScenarioList()
    }
})
scenarioPanel.add(createScenarioButton)

// // Settings
// var settingsPanel = ui.Panel({
//     layout: ui.Panel.Layout.flow('vertical'),
// })
// countryPanel.add(settingsPanel)

// var settingsPanelContents = ui.Panel({
//   layout: ui.Panel.Layout.flow('vertical'),
//   style: Styles.SECTION_STYLE,
// });
// settingsPanel.add(settingsPanelContents)

// settingsPanelContents.add(ui.Label({
//     value: 'Settings',
//     style: Styles.HEADER_STYLE_2,
// }));

// var changeCountryButton = ui.Button({
//     label: 'Change Country',
//     onClick: function () {
//         ui.root.widgets().set(0, UserInterface.generateLandingPage(app, true, landingPageStart, returnToMapView))
//     }
// })
// settingsPanelContents.add(changeCountryButton)

/*
*  Scenario Planner UI
*/

var createScenarioPanel = ui.Panel({style: {stretch: 'horizontal'}});
uiPanel.add(createScenarioPanel);

createScenarioPanel.style().set('shown', false);

createScenarioPanel.add(ui.Label({
    value: 'LDN Sceanrio Tool',
    style: Styles.HEADER_STYLE_1,
}));
  
createScenarioPanel.add(ui.Label({
    value: 'Please select the Year (or an existing scenario) to use as the starting point.',
    style: Styles.INTRO_STYLE,
}));

createScenarioPanel.add(Label('Select the starting point:'))

var createScenarioSelect = ui.Select({
    placeholder: 'Choose a scenario...',
});
createScenarioPanel.add(createScenarioSelect);

function updateScenarioList() {
    createScenarioSelect.items().reset(app.variables.transitionsList);
}

createScenarioPanel.add(Label('New scenario name:'))
var createScenaioName = ui.Textbox({
    placeholder: ''
})
createScenarioPanel.add(createScenaioName)

createScenarioPanel.add(
    ui.Panel([
        ui.Button({
            label: 'Create',
            onClick: function () {
                countryPanel.style().set('shown', true);
                createScenarioPanel.style().set('shown', false);
                var scenarioName = createScenaioName.getValue()
                var scenarioBase = createScenarioSelect.getValue()
                app.datasets.regionalData = ScenarioFunctions.createScenario(app.datasets.regionalData, scenarioBase, scenarioName);
                app.variables.scenarioList = app.variables.scenarioList.concat([scenarioName]);
                app.variables.transitionsList = app.variables.transitionsList.concat([scenarioName]);
                app.variables.currentScenario = scenarioName;
                regionalChartsBuilder()
                updateScenarioUIList()
                createScenarioSelect.setValue(null);
                createScenaioName.setValue(null);
            }
        }), 
        ui.Button({
            label: 'Cancel',
            onClick: function () {
                countryPanel.style().set('shown', true);
                createScenarioPanel.style().set('shown', false);
            }
        })],
        ui.Panel.Layout.flow('horizontal'),
        {stretch: 'vertical'}
    )
);


/**
 * Edit Scenario
 */

regionalEditPanel.add(ui.Label({
    value: 'Edit Scenario',
    style: Styles.HEADER_STYLE_2,
}));

var Tree2GrassText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Tree2CropText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Tree2ArtificialText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Grass2CropText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Grass2ArtificialText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Bare2GrassText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Bare2CropText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});
var Bare2ArtificialText = ui.Textbox({style: {margin: '8px 8px 8px auto'}});

var regionalEditDataPanel = ui.Panel([
    ui.Panel([
        ui.Label(value: 'Tree_Cover to Grasslands', {margin: '8px', padding: '6px 0'}), Tree2GrassText
    ], 
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Tree_Cover to Croplands', {margin: '8px', padding: '6px 0'}), Tree2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Tree_Cover to Artificial', {margin: '8px', padding: '6px 0'}), Tree2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Grasslands to Croplands', {margin: '8px', padding: '6px 0'}), Grass2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Grasslands to Artificial', {margin: '8px', padding: '6px 0'}), Grass2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Grasslands', {margin: '8px', padding: '6px 0'}), Bare2GrassText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Croplands', {margin: '8px', padding: '6px 0'}), Bare2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Artificial', {margin: '8px', padding: '6px 0'}), Bare2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal'))
])
regionalEditPanel.add(regionalEditDataPanel)

function setRegionalEditData(currentScenario) {
    // var currentScenario = app.variables.currentScenario;
    var currentRegion = ee.FeatureCollection(app.datasets.regionalData).filter(ee.Filter.eq('ADM2_NAME', app.variables.regionNameText)).first();
    var transitionsData = ee.Dictionary(currentRegion.get('landCoverTransitions'));
    var scenarioTransitionData = ee.Dictionary(transitionsData.get(currentScenario));

    scenarioTransitionData.evaluate(function(data) {
        Tree2GrassText.setValue(data['Tree_Cover to Grasslands']);
        Tree2CropText.setValue(data['Tree_Cover to Croplands']);
        Tree2ArtificialText.setValue(data['Tree_Cover to Artificial']);
        Grass2CropText.setValue(data['Grasslands to Croplands']);
        Grass2ArtificialText.setValue(data['Grasslands to Artificial']);
        Bare2GrassText.setValue(data['Bare_Land to Grasslands']);
        Bare2CropText.setValue(data['Bare_Land to Croplands']);
        Bare2ArtificialText.setValue(data['Bare_Land to Artificial']);
    })
}

function changeTablesToCharts() {
    var landTypesScenarioChart = regionalChartsPanel.widgets().get(1);
    landTypesScenarioChart.setChartType('ColumnChart');
    var transitionsChart = regionalChartsPanel.widgets().get(2);
    transitionsChart.setChartType('ColumnChart');
}

function getEditedData() {
    var adjustments = {
        'Tree_Cover to Grasslands': Tree2GrassText.getValue(),
        'Tree_Cover to Croplands': Tree2CropText.getValue(),
        'Tree_Cover to Artificial': Tree2ArtificialText.getValue(),
        'Grasslands to Croplands': Grass2CropText.getValue(),
        'Grasslands to Artificial': Grass2ArtificialText.getValue(),
        'Bare_Land to Grasslands': Bare2GrassText.getValue(),
        'Bare_Land to Croplands': Bare2CropText.getValue(),
        'Bare_Land to Artificial': Bare2ArtificialText.getValue()
    }
    return adjustments
}

regionalEditPanel.add(
    ui.Panel([
        ui.Button({
            label: 'Save',
            onClick: function () {
                regionalChartsPanel.style().set('shown', true);
                regionalEditPanel.style().set('shown', false);
                scenarioPanel.style().set('shown', true);
                settingsPanel.style().set('shown', true);
                // changeTablesToCharts();
                var updatedRegionalData = ScenarioFunctions.saveScenario(app.datasets.regionalData, getEditedData(), app.variables.regionNameText, app.variables.currentScenario, app.setup.startYear);
                print('Updated regional data', updatedRegionalData)
                app.datasets.regionalData = updatedRegionalData;
                regionalChartsBuilder()
            }
        }), 
        ui.Button({
            label: 'Cancel',
            onClick: function () {
                regionalChartsPanel.style().set('shown', true);
                regionalEditPanel.style().set('shown', false);
                scenarioPanel.style().set('shown', true);
                settingsPanel.style().set('shown', true);
                changeTablesToCharts();
            }
        })],
        ui.Panel.Layout.flow('horizontal'),
        {stretch: 'vertical'}
    )
);

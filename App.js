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
    variables: {
        region: null,
        regionNameText: null,
        scenarioList: null,
        transitionsList: null,
        currentScenario: null,
    },
    // scenarios: null
};

// var selectedPoint = [];

var yearList = ['2001', '2002', '2003', '2004', '2005', '2006',
                '2007', '2008', '2009', '2010', '2011', '2012',
                '2013', '2014', '2015', '2016', '2017', '2018',
                '2019'];

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
    // Clear charts panel
    // unpack variables
    // extract datasets
    // create charts

    regionalChartsPanel.clear()
    var regionNameText = app.variables.regionNameText;
    print(regionNameText)
    print("Regional Data:", app.datasets.regionalData)
    var currentRegion = ee.FeatureCollection(app.datasets.regionalData).filter(ee.Filter.eq('ADM2_NAME', regionNameText)).first()
    print(currentRegion)


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
}

// function calculateSDG(landCoverChange, countryGeometry) {
//     var pixelCount = landCoverChange.reduceRegion(
//         ee.Reducer.fixedHistogram(-1, 1, 3),
//         countryGeometry,
//         500
//     ).get('remapped');
//     var degredationCount = ee.Array(pixelCount).get([0,1])
//     var totalPixel = landCoverChange.reduceRegion(
//         ee.Reducer.count(),
//         countryGeometry,
//         500
//     ).get('remapped');

//     var SDG = ee.Number(degredationCount).divide(totalPixel)
//     var SDGOutput = ee.Number(SDG).format('%.2f').getInfo()
//     SDGIndicatorWidget.widgets().set(1, IndicatorLabel(SDGOutput + ' %'))
//     return SDG
// }

function loadCountry(country, startYear, targetYear) {
    mapPanel.clear()
    countryPanel.widgets().set(0, ui.Label({
        value: app.setup.country + ' LDN Analysis',
        style: Styles.HEADER_STYLE_1
    }))
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

    // Land Cover (Layer 0)
    var landCoverChange = LDNIndicatorData[0].clip(countryGeometry);
    mapPanel.addLayer(landCoverChange,{min: -1, max: 1, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Land Cover', false, 0.75);

    // Regional Land Cover Tiles (Layer 1)
    // Thoughts on -1 to 1 vs -0.2 to 0.2, the latter makes all changes much more easily identified?
    var regionalLandCoverChange = LDNIndicatorData[2].clip(countryGeometry);
    mapPanel.addLayer(regionalLandCoverChange,{min: -0.20, max: 0.20, palette: ['fc8d59', 'ffffbf', '1a9850']}, 'Regional Degredation', true, 0.9)

    // Land Cover (Layer 2)
    var soilOrganicCarbonChange = LDNIndicatorData[1].clip(countryGeometry);
    mapPanel.addLayer(soilOrganicCarbonChange,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Soil Organic Carbon Change', false, 0.75);

    // Productivity Trajectory (Layer 3)
    var productivityTrajectoryImage = LDNIndicatorData[3].clip(countryGeometry);
    mapPanel.addLayer(productivityTrajectoryImage, {min: 0, max: 3, palette: ['ffffbf', '#1a9850', 'fc8d59']}, 'Productivity Trajectory', false, 0.75)

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
    var longTermDroughtRiskClassified = droughtRisk[2].clip(countryGeometry);
    var droughtRiskPalette = {min: 4,max: -4, palette: ['#35978f', '#8c510a']};

    mapPanel.addLayer(currentDroughtRisk, droughtRiskPalette, 'Current Drought Risk', false, 0.9);
    mapPanel.addLayer(longTermDroughtRisk, droughtRiskPalette, 'Long Term Drought Risk', false, 0.9);
    mapPanel.addLayer(longTermDroughtRiskClassified, droughtRiskPalette, 'Classified Long Term Drought Risk', false, 0.9);

    mapPanel.centerObject(countryGeometry);
    mapPanel.onClick(handleMapClick);
}

// function updateSubRegionIndicator(regionNameText) {
//     subRegionIndicatorWidget.style().set('shown', true);
//     subRegionIndicatorWidget.widgets().set(1, Label('Loading...'));
//     var subRegionIndicator = app.datasets.regionalScores.filter(ee.Filter.eq('ADM2_NAME', regionNameText)).first();
//     subRegionIndicator.evaluate(function(result) {
//         var value = ee.Number(subRegionIndicator.get('Degraded_State')).format('%.2f').getInfo();
//         subRegionIndicatorWidget.widgets().set(1, IndicatorLabel(value + ' %'));
//     })
// }

function updateUI() {
    countryStartInstructions.style().set('shown', false); // Hide instructions
    var region = app.variables.region;
    var regionNameText = region.first().get('ADM2_NAME').getInfo();
    regionName.setValue(regionNameText);
    app.variables.regionNameText = regionNameText;
    // regionalDataEditButton.style().set('shown', true); // Just for development
    regionalChartsBuilder();
    createIndicatorsChart();
    // updateSubRegionIndicator(regionNameText);
    // updateScenarioEditPanel(regionNameText)
}

/** 
 * Base UI
 */

ui.root.clear()
var mapPanel = ui.Map()
var uiPanel = ui.Panel({style: {width: '500px', padding: '10px'}});
var splitPanel = ui.SplitPanel(mapPanel, uiPanel);
ui.root.add(splitPanel);

/**
 * Intro Panel
 */

var introPanel = ui.Panel({style: {stretch: 'horizontal'}});
uiPanel.add(introPanel);

introPanel.add(ui.Label({
  value: 'LDN Analysis Tool',
  style: Styles.HEADER_STYLE_1,
}));

introPanel.add(ui.Label({
    value: 'Please select a Country, Start and Target Year, or upload your saved settings file to start where you left off.',
    style: Styles.INTRO_STYLE,
}));

// Country
var countrySelect = ui.Select({
  placeholder: 'Choose a country...',
  onChange: function(country) {
    app.setup.country = country;
  }
})

var computedCountryList = ee.List(countries.reduceColumns(ee.Reducer.toList(), ['ADM0_NAME'])
    .get('list'))
    .distinct();

computedCountryList.evaluate(function(countryList) {
  countrySelect.items().reset(countryList);
  countrySelect.setValue('Ghana')
});

introPanel.add(Label('Country'));
introPanel.add(countrySelect);

// Start Year
var startYearSelect = ui.Select({
    items: yearList,
    value: '2009',
    onChange: function(year) {
        app.setup.startYear = year;
    }
});
introPanel.add(Label('Start Year'));
introPanel.add(startYearSelect);

// Target Year
var targetYearSelect = ui.Select({
    items: yearList,
    value: '2019',
    onChange: function(year) {
        app.setup.targetYear = year;
    }
});

introPanel.add(Label('Target Year'));
introPanel.add(targetYearSelect);

// Start
var startButton = ui.Button({
    label: 'Start',
    onClick: function () {
        print('Started')
        print(app)
        loadCountry(app.setup.country, app.setup.startYear, app.setup.targetYear);
        introPanel.style().set('shown', false);
        countryPanel.style().set('shown', true)
    }
});
introPanel.add(startButton);

/**
 * Country Panel
 */

var countryPanel = ui.Panel({style: {stretch: 'horizontal', shown: false}});
uiPanel.add(countryPanel);

countryPanel.add(ui.Label({
    value: app.setup.country + ' LDN Analysis',
    style: Styles.HEADER_STYLE_1
}))

// Start Instructions
var countryStartInstructions = ui.Panel({style: {stretch: 'horizontal', shown: true}});
countryPanel.add(countryStartInstructions);

countryStartInstructions.add(ui.Label({
    value: 'Please click on a region on the map to begin analysis.',
    style: Styles.INTRO_STYLE
}))

// Regional Data
var regionalDataPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
});
countryPanel.add(regionalDataPanel);

var regionName = ui.Label('', Styles.HEADER_STYLE_2);

var regionalDataEditButton = ui.Button({
    label: 'Edit',
    onClick: function () {
        var landTypesScenarioChart = regionalChartsPanel.widgets().get(0);
        landTypesScenarioChart.setChartType('Table')
        var transitionsChart = regionalChartsPanel.widgets().get(1);
        transitionsChart.setChartType('Table')
        setRegionalEditData()
        regionalEditPanel.style().set('shown', true);
        regionalDataEditButton.style().set('shown', false);
    }
});
regionalDataEditButton.style().set('shown', false);

regionalDataPanel.add(
    ui.Panel([
        regionName, 
        regionalDataEditButton
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

// Edit
var regionalEditPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
        shown: false
    }
});
regionalDataPanel.add(regionalEditPanel);

// For the Scenario Edit UI please see the scenario section

// Indicators
countryPanel.add(ui.Label({
  value: 'Key Indicators',
  style: Styles.HEADER_STYLE_2,
}));

var nationalIndicatorsChartPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
});
countryPanel.add(nationalIndicatorsChartPanel)

nationalIndicatorsChartPanel.add(ui.Label({
    value: 'Please click on a region on the map to begin analysis.',
    style: Styles.INTRO_STYLE
}));

function createIndicatorsChart() {
    var scenarioList = ee.List(app.variables.transitionsList);
    var nationalIndicators = app.datasets.nationalIndicators;
    var nationalIndicatorsChartData = scenarioList.map(function(item) {
        return ee.Dictionary(nationalIndicators.get(item)).values()
    })
    var nationalIndicatorsChart = ui.Chart.array.values(nationalIndicatorsChartData, 1, ee.Dictionary(nationalIndicators.get(scenarioList.get(0))).keys())
    .setSeriesNames(scenarioList)
    .setChartType('Table')
    
    nationalIndicatorsChartPanel.widgets().set(0, nationalIndicatorsChart)
}

// var SDGIndicatorWidget = ui.Panel([
//     Label('SDG 15.3.1 (Degraded Land / Total Area): '),
//     Label('Loading...')],
//     ui.Panel.Layout.flow('horizontal')
// )

// var nationalIndicatorWidget = ui.Panel([
//     Label('National Net Change / Total Area: '),
//     Label('Loading...')],
//     ui.Panel.Layout.flow('horizontal')
// )

// var subRegionIndicatorWidget = ui.Panel([
//     Label('Selected Region Net Change / Total Area: '),
//     Label('Loading...')],
//     ui.Panel.Layout.flow('horizontal'),
//     {shown: false}
// )

// var indicatorsDegredationStatePanel = ui.Panel({
//     widgets: [
//         SDGIndicatorWidget,
//         nationalIndicatorWidget,
//         subRegionIndicatorWidget
//     ],
//     layout: ui.Panel.Layout.flow('vertical'),
//     style: Styles.SECTION_STYLE
//   });
// countryPanel.add(indicatorsDegredationStatePanel)

// Analysis Layers
countryPanel.add(ui.Label({
    value: 'Analysis Layers',
    style: Styles.HEADER_STYLE_2,
}));

// Toggle between the Land Cover Mode map and the Pixel Layer. Default to Land Cover Mode
var togglePixelLayer = ui.Checkbox('Land Cover Pixel Layer', false);

togglePixelLayer.onChange(function(checked) {
  mapPanel.layers().get(0).setShown(checked);
  mapPanel.layers().get(1).setShown(!checked);
});
countryPanel.add(togglePixelLayer);

var toggleFireFreq = ui.Checkbox('Fire Frequecy Layer', false);

toggleFireFreq.onChange(function(checked) {
    mapPanel.layers().get(6).setShown(checked);
});
countryPanel.add(toggleFireFreq);

// Settings
var settingsPanel = ui.Panel({
    // layout: ui.Panel.Layout.absolute(),
    layout: ui.Panel.Layout.flow('vertical'),
    // style: {position: 'bottom-left'}
})
countryPanel.add(settingsPanel)

var settingsPanelContents = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  // style: {position: 'bottom-left'}
//   style: {margin: 'auto,0px,0px,0px', stretch: 'vertical'},
  style: Styles.SECTION_STYLE,
});
settingsPanel.add(settingsPanelContents)

settingsPanelContents.add(ui.Label({
    value: 'Settings',
    style: Styles.HEADER_STYLE_2,
}));

// // Toggle between the Land Cover Mode map and the Pixel Layer. Default to Land Cover Mode
// var togglePixelLayer = ui.Checkbox('Pixel Layer', false);

// togglePixelLayer.onChange(function(checked) {
//   Map.layers().get(0).setShown(checked);
//   Map.layers().get(1).setShown(!checked);
// });
// settingsPanel.add(togglePixelLayer);

// // Show or Hide the Legend. Default to Shown
// var toggleLegendDisplay = ui.Checkbox('Legend', false);

// toggleLegendDisplay.onChange(function(checked) {
//   legend.style().set('shown', checked);
// });
// settingsPanel.add(toggleLegendDisplay);

var createScenarioButton = ui.Button({
    label: 'Create Scenario',
    onClick: function () {
        countryPanel.style().set('shown', false)
        createScenarioPanel.style().set('shown', true)
        updateScenarioList()
    }
})
settingsPanelContents.add(createScenarioButton)

var changeCountryButton = ui.Button({
    label: 'Change Country',
    onClick: function () {
        countryPanel.style().set('shown', false)
        introPanel.style().set('shown', true)
    }
})
settingsPanelContents.add(changeCountryButton)

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
    // print("Scenario List", typeof app.variables.transitionsList, app.variables.transitionsList)
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
                regionalDataEditButton.style().set('shown', true);
                var scenarioName = createScenaioName.getValue()
                var scenarioBase = createScenarioSelect.getValue()
                app.datasets.regionalData = ScenarioFunctions.createScenario(app.datasets.regionalData, scenarioBase, scenarioName);
                app.variables.scenarioList = app.variables.scenarioList.concat([scenarioName]);
                app.variables.transitionsList = app.variables.transitionsList.concat([scenarioName]);
                app.variables.currentScenario = scenarioName;
                regionalChartsBuilder()
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

// Regional Data Edit Scenario
regionalEditPanel.add(ui.Label({
    value: 'Edit Scenario',
    style: Styles.HEADER_STYLE_2,
}));

var Tree2GrassText = ui.Textbox();
var Tree2CropText = ui.Textbox();
var Tree2ArtificialText = ui.Textbox();
var Grass2CropText = ui.Textbox();
var Grass2ArtificialText = ui.Textbox();
var Bare2GrassText = ui.Textbox();
var Bare2CropText = ui.Textbox();
var Bare2ArtificialText = ui.Textbox();

var regionalEditDataPanel = ui.Panel([
    ui.Panel([
        Label('Tree_Cover to Grasslands'), Tree2GrassText
    ], 
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Tree_Cover to Croplands'), Tree2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Tree_Cover to Artificial'), Tree2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Grasslands to Croplands'), Grass2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Grasslands to Artificial'), Grass2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Grasslands'), Bare2GrassText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Croplands'), Bare2CropText
    ],
    ui.Panel.Layout.flow('horizontal')),
    ui.Panel([
        Label('Bare_Land to Artificial'), Bare2ArtificialText
    ],
    ui.Panel.Layout.flow('horizontal'))
])
regionalEditPanel.add(regionalEditDataPanel)

function setRegionalEditData() {
    var currentScenario = app.variables.currentScenario;
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
    var landTypesScenarioChart = regionalChartsPanel.widgets().get(0);
    landTypesScenarioChart.setChartType('ColumnChart');
    var transitionsChart = regionalChartsPanel.widgets().get(1);
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
                regionalDataEditButton.style().set('shown', true);
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
                regionalDataEditButton.style().set('shown', true);
                changeTablesToCharts();
            }
        })],
        ui.Panel.Layout.flow('horizontal'),
        {stretch: 'vertical'}
    )
);

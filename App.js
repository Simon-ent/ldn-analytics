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
        predictionsData: null,
        landCoverStartCount: null,
        landCoverEndCount: null,
        landCoverTransistionsCount: null,
    },
    variables: {
        region: null,
        regionNameText: null,
        nationalIndicator: null,
    },
    scenarios: null
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
    mapPanel.layers().set(4, regionHighlight);
}

function handleMapClick(location) {
    var selectedPoint = [location.lon, location.lat];
    var region = app.datasets.subRegions.filterBounds(ee.Geometry.MultiPoint(selectedPoint));
    app.variables.region = region;
    updateOverlay();
    updateUI();
}

function regionalChartsBuilder(regionNameText) {
    regionalChartsPanel.clear()
    print(regionNameText)

    // Land Cover Over Time Chart
    var landTypes = ['Tree_Cover', 'Grasslands', 'Croplands', 'Wetlands', 'Artificial', 'Bare_Land', 'Water_Bodies'];
    var landDataProperties = ['Tree_Cover', 'Grasslands', 'Croplands', 'Wetlands', 'Artificial', 'Bare_Land', 'Water_Bodies', 'Year'];
    var landCoverStartCount = app.datasets.landCoverStartCount.filter(ee.Filter.eq('ADM2_NAME', regionNameText))
        .select(landDataProperties).first();
    var landCoverEndCount = app.datasets.landCoverEndCount.filter(ee.Filter.eq('ADM2_NAME', regionNameText))
        .select(landDataProperties).first();
    
    var regionLandCoverTimeSeries = ee.FeatureCollection([landCoverStartCount, landCoverEndCount]);

    var landTypesScenarioChart = ui.Chart.feature.byProperty(regionLandCoverTimeSeries, landTypes, 'Year')
        .setChartType('ColumnChart')
        .setOptions({
            title: 'Land Types by Year',
            vAxis: {title: 'Land Type'},
            hAxis: {title: 'Pixel Count', logScale: true},
            // isStacked: true,
            bar: { gap: 0 },
            orientation: 'vertical',
        });
    regionalChartsPanel.add(landTypesScenarioChart)

    // Transitions Chart
    var transitionTypes = [
        'Tree_Cover to Grasslands', 'Tree_Cover to Croplands', 'Tree_Cover to Artificial',
        'Grasslands to Croplands', 'Grasslands to Artificial',
        'Bare_Land to Grasslands', 'Bare_Land to Croplands', 'Bare_Land to Artificial'
    ];
    var landCoverTransistionsCount = app.datasets.landCoverTransistionsCount.filter(ee.Filter.eq('ADM2_NAME', regionNameText))
        .select(transitionTypes).first();
    landCoverTransistionsCount = landCoverTransistionsCount.set({Series_Name: 'Predictions'});
    
    var landCoverTransistionsSeries = ee.FeatureCollection([landCoverTransistionsCount]);
    var transitionsChart = ui.Chart.feature.byProperty(landCoverTransistionsSeries, transitionTypes, 'Series_Name')
        .setChartType('ColumnChart')
        .setOptions({
        title: 'Land Cover Transitions',
        hAxis: {title: 'Net Change'},
        orientation: 'vertical',
    });
    regionalChartsPanel.add(transitionsChart);
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
    app.datasets.countryGeometry = countryGeometry;
    app.datasets.regions = regions;
    app.datasets.subRegions = subRegions;

    /**
     * LDN Indicators
     */

    // var outputImages = LDNIndicatorFunctions.LDNIndicatorImages(startYear, targetYear, subRegions)
    var outputImages = LDNIndicatorFunctions.LDNIndicatorData(startYear, targetYear, subRegions)

    // Data
    app.datasets.landCoverStartCount = outputImages[3];
    app.datasets.landCoverEndCount = outputImages[4];
    app.datasets.landCoverTransistionsCount = outputImages[5];
    var predictionsData = outputImages[6];
    app.datasets.predictionsData = outputImages[6];
    app.scenarios = ee.FeatureCollection([predictionsData])
    // print(predictionsData)
    // app.datasets.landCoverStartCount = predictionsData.filter(ee.Filter.eq('id', 'landCoverStartCount')).first();
    // app.datasets.landCoverEndCount = predictionsData.filter(ee.Filter.eq('id', 'landCoverEndCount')).first();
    // app.datasets.landCoverTransistionsCount = predictionsData.filter(ee.Filter.eq('id', 'landCoverTransistionsCount')).first();
    // print(app.datasets.landCoverStartCount)
    // print(outputImages[3])

    // Land Cover (Layer 0)
    var landCoverChange = outputImages[0].clip(countryGeometry);
    mapPanel.addLayer(landCoverChange,{min: -1, max: 1, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Land Cover', false, 0.75);

    // Regional Land Cover Tiles (Layer 1)
    // Thoughts on -1 to 1 vs -0.2 to 0.2, the latter makes all changes much more easily identified?
    var regionalLandCoverChange = outputImages[2].clip(countryGeometry);
    mapPanel.addLayer(regionalLandCoverChange,{min: -0.20, max: 0.20, palette: ['fc8d59', 'ffffbf', '1a9850']}, 'Regional Degredation', true, 0.9)

    // Land Cover (Layer 2)
    var soilOrganicCarbonChange = outputImages[1].clip(countryGeometry);
    mapPanel.addLayer(soilOrganicCarbonChange,{min: -1, max: 3, palette: ['fc8d59', '#ffffbf', '1a9850']}, 'Soil Organic Carbon Change', false, 0.75);

    // Regional Outlines (Layer 3)
    mapPanel.addLayer(HelperFunctions.RegionsOverlay(ee.Image().byte(), regions, subRegions), {palette:['808080']}, 'Regions', true, 0.85);

    // Selected Region Outline (Layer 4)
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

    // Fire Frequency (Layer 5)
    var fireFrequency = AnalysisLayers.FireFrequencyAnalysis(startYear, targetYear).clip(countryGeometry)
    mapPanel.addLayer(fireFrequency, {min: 0, max: 1, palette: ['#ffeda0', '#de2d26']}, 'Fire Frequency', false, 0.5);

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
    regionalChartsBuilder(regionNameText);
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
        // var landTypesScenarioChart = regionalChartsPanel.widgets().get(1);
        // landTypesScenarioChart.setChartType('Table')
        // var transitionsChart = regionalChartsPanel.widgets().get(0);
        // transitionsChart.setChartType('Table')
        // // regionalChartsPanel.style().set('shown', false);
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

// Not brought over Tree2GrassText -> saveEditData()

regionalEditPanel.add(
    ui.Panel([
        ui.Button({
            label: 'Save',
            onClick: function () {
                regionalChartsPanel.style().set('shown', true);
                regionalEditPanel.style().set('shown', false);
                regionalDataEditButton.style().set('shown', true);
                changeTablesToCharts();
                saveEditData();
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

// Indicators
countryPanel.add(ui.Label({
  value: 'Key Indicators',
  style: Styles.HEADER_STYLE_2,
}));

var SDGIndicatorWidget = ui.Panel([
    Label('SDG 15.3.1 (Degraded Land / Total Area): '),
    Label('Loading...')],
    ui.Panel.Layout.flow('horizontal')
)

var nationalIndicatorWidget = ui.Panel([
    Label('National Net Change / Total Area: '),
    Label('Loading...')],
    ui.Panel.Layout.flow('horizontal')
)

var subRegionIndicatorWidget = ui.Panel([
    Label('Selected Region Net Change / Total Area: '),
    Label('Loading...')],
    ui.Panel.Layout.flow('horizontal'),
    {shown: false}
)

var indicatorsDegredationStatePanel = ui.Panel({
    widgets: [
        SDGIndicatorWidget,
        nationalIndicatorWidget,
        subRegionIndicatorWidget
    ],
    layout: ui.Panel.Layout.flow('vertical'),
    style: Styles.SECTION_STYLE
  });
countryPanel.add(indicatorsDegredationStatePanel)

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
    mapPanel.layers().get(5).setShown(checked);
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
    // items: ['predictions'],
    // value: 'predictions',
    // onChange: function(scenario) {
    //     // print(scenario)
    //     // app.variables.scenarioBase = scenario;
    // }
});
createScenarioPanel.add(createScenarioSelect);

function updateScenarioList() {
    var computedScenarioList = ee.List(app.scenarios.reduceColumns(ee.Reducer.toList(), ['id'])
        .get('list'));
        // .distinct();

    computedScenarioList.evaluate(function(scenarioList) {
        createScenarioSelect.items().reset(scenarioList);
        // createScenarioSelect.setValue('predictions')
    });
}

createScenarioPanel.add(Label('New scenario name:'))
var createScenaioName = ui.Textbox({
    // placeholder: '2019_Scenario_1'
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
                app.scenarios = ScenarioFunctions.createScenario(app.scenarios, createScenarioSelect.getValue(), createScenaioName.getValue());
                // print("Scenario: ", createScenarioSelect.getValue(), createScenaioName.getValue())
                regionalDataEditButton.style().set('shown', true);
                createScenarioSelect.setValue('predictions');
                createScenaioName.setValue('');
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
exports.generateLandingPage = function(app, showBackButton, landingPageStart, returnToMapView) {
    var countries = ee.FeatureCollection("FAO/GAUL/2015/level0");
    var yearList = ['2001', '2002', '2003', '2004', '2005', '2006',
                  '2007', '2008', '2009', '2010', '2011', '2012',
                  '2013', '2014', '2015', '2016', '2017', '2018',
                  '2019'];
    
    var landingPage = ui.Panel({
        layout: ui.Panel.Layout.flow('vertical'),
        style: {
          stretch: 'horizontal'
        }
    })
    
    var altusImpactLogo = ui.Chart(
    [
      ['<img src=https://altusimpact.com/wp-content/themes/start-child-01/img/altus-white-retina.png width=150px style="background-color:#307869; padding:10px">']
    ],
    'Table', {allowHtml: true});
    
    altusImpactLogo.style().set({
      margin: '0 0 0 auto'
    })
    
    landingPage.add(altusImpactLogo)
    
    var introPanel = ui.Panel({
      style: {
        margin: '5% auto 0 auto',
      }
    })
    landingPage.add(introPanel)
  
    introPanel.add(ui.Label({
      value: 'GEO LDN Analysis Tool',
      style: {
        fontSize: '24px',
        margin: '0 auto 10px auto',
      }
    }));
    
    introPanel.add(ui.Label({
      value: 'Welcome to the LDN Analysis tool. Use it to investigate land changes and plan for an LDN future.',
      style: {
        fontWeight: 'lighter',
        margin: '0 0 20px 0'
      }
    }));
    
    // Country
    var countrySelect = ui.Select({
      placeholder: 'Choose a country...',
      onChange: function(country) {
        print(country);
        app.setup.country = country;
      }
    })
    
    var computedCountryList = ee.List(countries.reduceColumns(ee.Reducer.toList(), ['ADM0_NAME'])
        .get('list'))
        .distinct()
        .sort();
    
    computedCountryList.evaluate(function(countryList) {
      countrySelect.items().reset(countryList);
      countrySelect.setValue('Ghana')
    });
    
    // Start Year
    var startYearSelect = ui.Select({
        items: yearList,
        value: '2009',
        onChange: function(year) {
            app.setup.startYear = year;
        }
    });
    
    // Target Year
    var targetYearSelect = ui.Select({
        items: yearList,
        value: '2019',
        onChange: function(year) {
            app.setup.targetYear = year;
        }
    });
    
    // Start
    var startButton = ui.Button({
        label: 'Start',
        onClick: function () {
            print('Started')
            print(app)
            landingPageStart()
        }
    });
    
    var backButton = ui.Button({
      label: 'Back',
      onClick: function () {
          print('Back')
          returnToMapView()
          // print(app)
      }
    })
    backButton.style().set('shown', showBackButton)
    
    var optionsPanel = ui.Panel({style:{
      // margin: '0 auto'
    }});
    introPanel.add(optionsPanel);
    
    optionsPanel.add(ui.Label({
      value: '1. Select a Country', 
      style: {
        fontWeight: 'bold'
      }}));
    optionsPanel.add(ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style:{
        margin: '0 0 10px 0'
      },
      widgets: [ui.Panel({
        layout: ui.Panel.Layout.flow('horizontal'),
        widgets: [ui.Label({
          value: 'Country', 
          style: {
            fontWeight: 'lighter'
          }}), 
          countrySelect]
        })
      ]
    }))
    optionsPanel.add(ui.Label({
      value: '2. Choose the period over which the analysis will run', 
      style: {
        fontWeight: 'bold'
      }}));
    optionsPanel.add(ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style:{
        margin: '0 0 10px 0'
      },
      widgets: [ui.Panel({
        layout: ui.Panel.Layout.flow('horizontal'),
        widgets: [ui.Label({
          value: 'Start Year', 
          style: {
            fontWeight: 'lighter'
          }}), 
          startYearSelect]
        }), 
        ui.Panel({
          layout: ui.Panel.Layout.flow('horizontal'),
          widgets: [ui.Label({
            value: 'Target Year', 
            style: {
              fontWeight: 'lighter'
            }}), 
            targetYearSelect]
        })
      ]
    }))
    
    optionsPanel.add(ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      widgets: [startButton, backButton],
      style: {margin: '15px 0 15px auto'}
    }))
    return landingPage
  }

// exports.loadMainPage() {
//     // ui.root.clear()
//     var mapPanel = ui.Map()
//     var uiPanel = ui.Panel({style: {width: '500px', padding: '10px'}});
//     var splitPanel = ui.SplitPanel(mapPanel, uiPanel);
//     ui.root.add(splitPanel);
// }
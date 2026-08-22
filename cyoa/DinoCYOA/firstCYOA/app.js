/* 

This is our main brains. Right now it controls the state, program constants, and calls the renderer.

*/

import render from './render.js' // imports the render function    
     
     // state variables
     // this stores the user's selections
      let selectedPatron = null // this stores the user's options, controlled by setSelectedPatrons
      let selectedFaction = null
      const BASE_POINTS = 30
      let points = BASE_POINTS // this is the points, which is controlled by nothing right now, just wiring up the selectedOptions now.

      // program constants

      // here we have our data sets. I want to keep this simple, each renderer handling a specific object. So like, instead of it being the data file as a whole, then children, then children, its just gonna be 'renderHero, renderPatrons,' and so on

      
      const patrons = [
        {name: 'Tali', description: "A biggie dino!", imageURL: 'dino.jpg', traits: ['likes making stompies', 'enjoys peanut butter', 'very sad peanut butter not invented yet'], points : 1},

        {name: 'Miku', description: "The great winged one!", traits: ['Will give rides', 'Loves the water', 'Loves long flights above the beach'], imageURL: 'flyer.jpg', points: 2},

        {name: 'Speedy Gonzales', description: "Soft boy, pleased with facial feather growth", traits: ['Wants uppies', '404 gender not found', 'Squirrel! Has never seen one, but needs to chase one'], imageURL: 'velo.png', points: 2},

        {name: 'The King', description: "Gayer than Dino Jesus", traits: ['Excellent cook', 'Trans rights or gives bites', "Bowsette's bestie"], imageURL: 'trex.jpg', points: 3},

        {name: 'Dino Jesus', description: "Less gay than the King", traits: ['Openly Libertarian', 'Confuses librarian with libertarian', 'Ao3 writer'], imageURL: 'trex.jpg', points: 1},

        {name: 'Jeff', description: "He looks like a Jeff", traits: ['Cursed to play bongos', 'Sensual kisser', 'Needs scritches'], imageURL: 'anky.jpg', points: 2},

        {name: 'Dino Sandra Bullock', description: "From a distance, she looks like Jeff... I swear", traits: ['My partner dies inside every time I say her name', 'Star of Miss Scaliality', 'Can lick her elbow'], imageURL: 'stag.jpg', points: 4},

        {name: 'Miette', description: "'My first love' -- Chuck Tingle", traits: ["Chuck Tingle's personal muse", 'Rootinest tootinest', 'Read the whole dictionary. Insists is not autistic.'], imageURL: 'tri.png', points: 4},

      ]
      const factions = [
        {name: 'Water Gun', description: "Strong enough to hit outer space", traits: ['its really fun', 'can even hit meteors', "no one cares because meteors can't get mad"], imageURL: 'cannon.jpg', points : 1},
        {name: 'Dino Skates', description: "What's cooler than a dinosaur on roller skates??", traits: ['Goes wheeeeeeee', 'Good for enrichment', 'Helps get them to dino school on time'], imageURL: 'skates.jpg', points : 1},
        {name: 'THE BANANA', description: "Ohhhhh banana!", traits: ['Grind for banana', 'Earn banana', 'Cherish banana'], imageURL: 'banana.png', points : 9},
        {name: 'Cute rock', description: "It means no harm, I prommy~", traits: ['Give your pet a pet rock', 'Super fast', 'Nice and warm'], imageURL: 'rock.jpeg', points : '0'},
      ]


      // display constants
      // I need to look up the look up table stuff again, but this gets read in renderHeader inside the render function
      const hero = [
        { text:"Silly Pet Dino CYOA",
          bgImage: "heroBG.jpg"
        }
      ]
      const PATRON_SECTION = {
        heading: "Choose your Dino pet uWu"
      }

      const FACTION_SECTION = {
        heading: "Now give your Dino stuffables!"
      }

      // named functions

      const recalcPoints = () => {
        points = BASE_POINTS
        if(selectedPatron) points -= selectedPatron.points
        if(selectedFaction) points -= selectedFaction.points
      }


      // our specific funtions will go here later, but right now I want to just do the setSelectedOptions

      /* setter functions */

      const setSelectedPatron = (newPatron) => {

        selectedPatron = newPatron
        recalcPoints()
          console.log(points)

          render(points, patrons, hero, setSelectedPatron, selectedPatron, setSelectedFaction, selectedFaction, factions, PATRON_SECTION, FACTION_SECTION)
      }

      const setSelectedFaction =(newFaction) => {
        selectedFaction = newFaction
        recalcPoints()
        render(points, patrons, hero, setSelectedPatron, selectedPatron, setSelectedFaction, selectedFaction, factions, PATRON_SECTION, FACTION_SECTION)
      }

      // so the render function is getting passed a few things here. points goes to renderPoints, patrons goes to renderPatrons, hero goes to renderHero and setSelectedOptions goes to onClick.
      render(points, patrons, hero, setSelectedPatron, selectedPatron, setSelectedFaction, selectedFaction, factions, PATRON_SECTION, FACTION_SECTION)

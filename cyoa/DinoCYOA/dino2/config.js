// Config section


export const TOTAL_BUDGET = 10

const dinos = [
  {
    name: 'Tali',
    label: 'A biggie dino!',
    cost: 1,
    imageURL: 'dino.jpg',
    traits: ['likes making stompies', 'enjoys peanut butter', 'very sad peanut butter not invented yet']
  },
  {
    name: 'Miku',
    label: 'The great winged one!',
    cost: 2,
    imageURL: 'flyer.jpg',
    traits: ['Will give rides', 'Loves the water', 'Loves long flights above the beach']
  },
  {
    name: 'Speedy Gonzales',
    label: 'Soft boy, pleased with facial feather growth',
    cost: 2,
    imageURL: 'velo.png',
    traits: ['Wants uppies', '404 gender not found', 'Squirrel! Has never seen one, but needs to chase one']
  },
  {
    name: 'The King',
    label: 'Gayer than Dino Jesus',
    cost: 3,
    imageURL: 'trex.jpg',
    traits: ['Excellent cook', 'Trans rights or gives bites', "Bowsette's bestie"]
  },
  {
    name: 'Dino Jesus',
    label: 'Less gay than the King',
    cost: 1,
    imageURL: 'trex.jpg',
    traits: ['Openly Libertarian', 'Confuses librarian with libertarian', 'Ao3 writer']
  },
  {
    name: 'Jeff',
    label: 'He looks like a Jeff',
    cost: 2,
    imageURL: 'anky.jpg',
    traits: ['Cursed to play bongos', 'Sensual kisser', 'Needs scritches']
  },
  {
    name: 'Dino Sandra Bullock',
    label: 'From a distance, she looks like Jeff... I swear',
    cost: 4,
    imageURL: 'stag.jpg',
    traits: ['My partner dies inside every time I say her name', 'Star of Miss Scaliality', 'Can lick her elbow']
  },
  {
    name: 'Miette',
    label: "'My first love' -- Chuck Tingle",
    cost: 4,
    imageURL: 'tri.png',
    traits: ["Chuck Tingle's personal muse", 'Rootinest tootinest', 'Read the whole dictionary. Insists is not autistic.']
  }
]

const stuffables = [
  {
    name: 'Water Gun',
    label: 'Strong enough to hit outer space',
    cost: 1,
    imageURL: 'cannon.jpg',
    traits: ['its really fun', 'can even hit meteors', "no one cares because meteors can't get mad"]
  },
  {
    name: 'Dino Skates',
    label: "What's cooler than a dinosaur on roller skates??",
    cost: 1,
    imageURL: 'skates.jpg',
    traits: ['Goes wheeeeeeee', 'Good for enrichment', 'Helps get them to dino school on time']
  },
  {
    name: 'THE BANANA',
    label: 'Ohhhhh banana!',
    cost: 9,
    imageURL: 'banana.png',
    traits: ['Grind for banana', 'Earn banana', 'Cherish banana']
  },
  {
    name: 'Cute rock',
    label: 'It means no harm, I prommy~',
    cost: 0,
    imageURL: 'rock.jpeg',
    traits: ['Give your pet a pet rock', 'Super fast', 'Nice and warm']
  }
]

export const selectionGroups = [
  { id: 'dinos',      label: 'Choose your Dino pet uWu',       max: 1,        options: dinos },
  { id: 'stuffables', label: 'Now give your Dino stuffables!', max: Infinity, options: stuffables }
]
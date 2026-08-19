import { fileURLToPath} from 'url'
import {dirname, join} from 'path'

const myPath = fileURLToPath(import.meta.url)
console.log(myPath) // this will be the whole directory minus the fil:///
console.log(dirname(myPath)) // this will be myPath minus the file name 
console.log(join(dirname(myPath), 'test-page.html'))
const request = require('request'),
{ JSDOM } = require('jsdom'),
JsonDB =  require('node-json-db'),
DB = new JsonDB("db", true, false);

/**
 * 💥 Simple website scraper. Scrape products, news and other data of any website! !!!Please. Use it only to learn Node JS, but not scraping data!!!
 * Simple use it:
 * const Scraper = require("./scraper");
 * Scraper.url = "https://example.com/";
 * Scraper.limit = 20;
 * Scraper.offset = 5;
 * Scraper.run();
 */
class Scraper {
  constructor() {
    this.parseArgs()
    this.initDefaults()
  }

  initDefaults() {
    this.mainCategories = []; // {url, title}
    this.selectors = {
      category: {
        main: "#sidebar .categories a",
        child: ".page .categories a"
      }
    }
    this.storage = {
      category: {
        main: "maincat"
      }
    }
  }

  parseArgs() {
    process.argv.forEach( (val) => {
      let arg = val.split("="),
      k, v;

      if(arg.length < 2) return;
      ( [k,v] = arg );

      if( k in this.argumentToVariable)
        this.params[ this.argumentToVariable[k] ] = v;

    })

    console.info(`Arguments was successfully parsed.`)
  }

  run() {
    this.findMainCategories()
    // .then(findAllItems)
  }

  findAllItems() {
    // TODO..................
  }

  findMainCategories() {
    return new Promise((resolve) => {
      let mainCats;
      if(mainCats = DB.getData(`@${this.storage.category.main}`) && this.params.cache === true) {
        console.log("Were obtained from the cache... Run with argument \"-c=false\" for ignore cache");
        this.mainCategories = mainCats;
        resolve(this.mainCategories);
        return;
      }

      request(this.params.url, (err, res, body) => {
        console.info(`Categories list page was downloaded from ${this.params.url}...`)
        this.createDom(body).then(
          $ => this.parseMainCategories($).then(resolve),
          e => console.error(e)
        )
      })

    })
  }

  parseMainCategories($) {
    return new Promise(resolve => {
      console.info("Categories list page was parsed...")

      let cats = $.find(this.selectors.category.main)

      console.info(`I'm find ${cats.length} categories!`)

      cats.forEach((element) => {
        this.mainCategories.push({
          name: $(element).text(),
          link: $(element).attr("href")
        });
      })

      if(!this.mainCategories.length) {
        console.error("Sorry, i'm cant't parse categories... Check the selectors.category.main parametr")
      }else{
        DB.push(`@${this.storage.category.main}`, this.mainCategories)
      }

      resolve(this.mainCategories);
    })
  }

  createDom(html = "") {
    return new Promise((resolve, reject) => {
      let dom = new JSDOM(html)
      var $ = require("jquery")(dom.window);
      resolve($);
    })
  }
}

Scraper.prototype.params = {
  "url" : "",
  "limit": 0,
  "offset": 0,
  "logsLevel": 0,
  "force": false,
  "cache" : true,
  //TODO:
  "proxy": [] //{url,port,login,password,weight}
}
Scraper.prototype.argumentToVariable = {
  "-u": "url",
  "--url": "url",
  "-l": "limit",
  "--limit": "limit",
  "-o": "offset",
  "--offset": "offset",
  "-l": "logsLevel",
  "--loglevel": "logsLevel",
  "-f": "force",
  "--force": "force",
  "-c" : "cache",
  "--cache" : "cache"
} // {name:value}

module.exports = new Scraper()

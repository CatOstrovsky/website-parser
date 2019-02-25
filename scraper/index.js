const request = require('request'),
{ JSDOM } = require('jsdom'),
JsonDB =  require('node-json-db'),
json2xlsx = require('json2xls'),
fs = require('fs'),
DB = new JsonDB("db", true, false),
downloadImage = require('image-downloader');

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
    this.mainProducts = []; // Any
    this.outFormat = `xlsx`;
    this.outFile = `./out/parsed_`+Date.now()
    this.imagesDestPath = "./out/images/"

    this.selectors = {
      category: {
        main: "#sidebar .categories a",
        child: ".page .categories a"
      },
      products: {
        main: "#main .product",
      }
    }
    this.storage = {
      category: {
        main: "maincat"
      },
      product: {
        main: "mainprod"
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

  saveToDisk() {
    switch (this.outFormat) {
      case "xlsx":
        this.saveToXLSX()
        break;
      default:
        this.saveToXLSX()
    }
  }

  saveToXLSX() {
    let filename = `${this.outFile}.${this.outFormat}`;
    fs.writeFileSync(`${filename}`, json2xlsx(this.mainProducts), 'binary');
    console.info(`Saved to file ${filename}`)
  }

  getFullUrl(url) {
    return ( (url.indexOf(this.params.url) < 0) ? this.params.url : "") + url
  }

  saveImageToDisk(url) {
    let fullUrl = this.getFullUrl(url);
    downloadImage({
      url: fullUrl,
      dest: this.imagesDestPath
    })

    return `${this.imagesDestPath}${fullUrl.replace(/^.*[\\\/]/, '')}`;
  }

  run() {
    this.findMainCategories()
    .then(() => this.findAllItems())
    .then(() => this.saveToDisk())
  }

  promiseRequest(link) {
    return new Promise((resolve) => {
      request(link, { json: true }, (err, res, body) => resolve({err, res, body}));
    })
  }

  findAllItems() {
    return new Promise((resolve) => {
      let products;
      if( (products = DB.getData(`${this.storage.product.main}`)) && this.params.cache === true) {
        console.log("Were obtained products from the cache... Run with argument \"-c=false\" for ignore cache");
        this.mainProducts = products;
        resolve(this.mainProducts);
        return;
      }
      console.log("Find all prodcuts")
      let promises = [];
      this.mainCategories.forEach((item) => {
        if(!item.link.length) return;

        let p = this.promiseRequest( this.getFullUrl(item.link) )
        .then((res) => {
          let $ = this.createDom(res.body, false);
          this.parseMainProducts($);
        });
        promises.push(p);
      });

      // When all products was parsed
      Promise.all(promises).then(() => {
        console.log(`Parsed ${this.mainProducts.length} products!`);
        DB.push(`${this.storage.product.main}`, this.mainProducts)
        resolve(this.mainProducts);
      });

    })
  }

  parseMainProducts($) {
    $.find(this.selectors.products.main).forEach((product) => {
      let data = this.processProduct($, product);
      this.mainProducts.push(data)
    });
  }

  /**
   * overwritable method for parsing singple product item
   * @param  {jQuery} $
   * @param  {jQuery} product
   * @return {json}
   */
  processProduct($, product) {
    return {
      title: $(product).find(".item-title a").text()
    }
  }

  findMainCategories() {
    return new Promise((resolve) => {
      let mainCats;
      if(( mainCats = DB.getData(`${this.storage.category.main}`) ) && this.params.cache === true) {
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
        DB.push(`${this.storage.category.main}`, this.mainCategories)
      }

      resolve(this.mainCategories);
    })
  }

  createDom(html = "", async = true) {
    let parse = () => {
      let dom = new JSDOM(html)
      return require("jquery")(dom.window);
    }
    if(async)
      return this.createDomAsync(parse)
    else
      return parse();
  }

  createDomAsync(fun) {
    return new Promise((resolve) => {
      let $ = fun();
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

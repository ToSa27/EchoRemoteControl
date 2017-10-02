var casper = require('casper').create({
    pageSettings: {
        loadImages: true, // false ok except for captcha
        loadPlugins: false,
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
});

if (casper.cli.args.length < 2) {
    console.log('Usage: casperjs LaylaLogin.js {username} {password} [{proxy} [{verbose}]]')
    casper.exit(-1);
}
var username = casper.cli.args[0].toLowerCase();
var password = casper.cli.args[1].toLowerCase();
if (casper.cli.args.length > 2)
    casper.pageSettings.proxy = casper.cli.args[2];
var verbose = (casper.cli.args.length > 3) ? (casper.cli.args[3].toLowerCase() == 'true') : false;

function debug(msg) {
    if (verbose)
        console.log(msg);
}

var fs = require('fs');

function clear(prefix) {
    try {
        fs.unlink('alexa-' + prefix + '.png');
    } catch(ex) { }
    try {
        fs.unlink('alexa-' + prefix + '.html');
    } catch(ex) { }
}

function clearAll() {
    clear('start');
    clear('signin');
    clear('captcha');
    clear('captchaTimeout');
    clear('bootstrap');
    clear('bootstrapTimeout');
}

function dump(page, prefix) {
    if (verbose) {
        console.log(prefix);
        page.capture('alexa-' + prefix + '.png');
        fs.write('alexa-' + prefix + '.html', page.getHTML(), "w");
    }
    fs.write('alexa-' + username + '.json', JSON.stringify(phantom.cookies), "w");
}

casper.start("https://layla.amazon.de", function() {
    dump(this, 'start');
});

casper.waitForUrl(/\/ap\/signin/, function() {
    dump(this, 'signin');
    this.wait(1000, function() {
        var userInput = 'input#ap_email';
        this.mouseEvent('click', userInput, '15%', '48%');
        this.sendKeys(userInput, username);
        this.wait(1000, function() {
            var passInput = 'input#ap_password';
            this.mouseEvent('click', passInput, '12%', '67%');
            this.sendKeys(passInput, password);
            this.wait(1000, function() {
                this.mouseEvent('click', 'input#signInSubmit', '50%', '50%');
            });
        });
    });
});

casper.waitForSelector('#auth-warning-message-box', function() {
    dump(this, 'captcha');
    var passInput = 'input#ap_password';
    this.mouseEvent('click', passInput, '12%', '67%');
    this.sendKeys(passInput, password);
    this.wait(1000, function() {
        while (true) {
            if (fs.isFile('alexa-Captcha.txt')) {
                var captchaText = fs.readFileSync('alexa-Captcha.txt').trim();
                var captchaInput = 'auth-captcha-guess';
                this.mouseEvent('click', captchaInput, '13%', '58%');
                this.sendKeys(captchaInput, captchaText);
                break;
            }
        }
        this.mouseEvent('click', 'input#signInSubmit', '50%', '50%');
    });
}, function() {
    dump(this, 'captchaTimeout');
}, 5000);

casper.waitForResource(/\/api\/bootstrap/, function() {
    dump(this, 'bootstrap');
    casper.exit(0);
}, function() {
    dump(this, 'bootstrapTimeout');
    for (var i = 0; i < phantom.cookies.length; i++)
        if (phantom.cookies[i].name == 'csrf')
            casper.exit(0);
    casper.exit(-1);
}, 10000);

clearAll();
casper.run();

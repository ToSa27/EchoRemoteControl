var request = require('request');
var fs = require('fs');
var execSync = require('child_process').execSync;

var config = null;
try {
    config = JSON.parse(fs.readFileSync('LaylaConfig.json'));
} catch (ex) {
    console.log('error reading config');
    process.exit(-1);
}

function debug(msg) {
    if (config.verbose)
        console.log(msg);
}

if (process.argv.length != 4) {
    debug('Usage: node LaylaCommand.js {device} {command}')
    process.exit(-1);
}
if (!config.devices.hasOwnProperty(process.argv[2].toLowerCase())) {
    debug('Unknown Device: ' + process.argv[2]);
    process.exit(-1);
}
var device = config.devices[process.argv[2].toLowerCase()];
if (!config.accounts.hasOwnProperty(device.account.toLowerCase())) {
    debug('Unknown Account: ' + device.account);
    process.exit(-1);
}
var account = config.accounts[device.account.toLowerCase()];
if (!config.commands.hasOwnProperty(process.argv[3].toLowerCase())) {
    debug('Unknown Command: ' + process.argv[3]);
    process.exit(-1);
}
var command = config.commands[process.argv[3].toLowerCase()];

var jar = null;
var csrf = null;

function execLogin() {
    debug('login');
    try {
        var cmd = 'node_modules\\casperjs\\bin\\casperjs LaylaLogin.js';
        cmd += ' ' + account.username;
        cmd += ' ' + account.password;
        if (proxy)
            if (proxy != '') {
                cmd += ' ' + proxy;
                if (verbose)
                    cmd += ' true';
            }
        var p = execSync(cmd, { stdio: [ 0, 1, 2 ] });
        loadCookies();
    } catch (ex) {
        debug('login failed')
        process.exit(-1);
    }
}

function loadCookies() {
    debug('load');
    jar = request.jar();
    csrf = null;
    try {
        var cookies = JSON.parse(fs.readFileSync('alexa-' + account.username + '.json'));
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i];
            jar.setCookie(request.cookie(cookie.name + '=' + cookie.value), 'https://layla.amazon.de');
            if (cookie.name == 'csrf')
                csrf = cookie.value;
        }
        callService();
    } catch (ex) {
        execLogin();
    }
}

function callService() {
    debug('call');
    request({
        method: 'POST',
        keepAlive: true,
        url: 'https://layla.amazon.de/api/np/command',
        qs: {
            deviceSerialNumber: device.deviceSerialNumber,
            deviceType: device.deviceType
        },
        proxy: config.proxy,
        strictSSL: false,
        jar: jar,
        headers: { 
            'cache-control': 'no-cache',
            csrf: csrf,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
        },
        json: true,
        body: { type: command }
    }, (error, response, body) => {
        if (error) 
            process.exit(-1);
        if (response.statusCode == 400) {
            if (response.headers.hasOwnProperty('x-amzn-error'))
                console.log('error: ' + response.headers['x-amzn-error']);
            console.log(JSON.stringify(body));
            process.exit(-1);
        } else if (response.statusCode == 401) {
            execLogin();
            return;
        } else if (response.statusCode == 200) {
            console.log(JSON.stringify(body));
            process.exit(0);
        } else {
            process.exit(-1);            
        }
    });
}
            
loadCookies();
#!/usr/bin/env node

const [,, ...args] = process.argv;

const fs = require('fs');

if(args[0] == 'init') {
    // init a website
    if(args[1]) {
        if (!fs.existsSync(args[1]))
            fs.mkdirSync(args[1]);
        process.chdir(args[1]);
    }

    console.log('Creating new website...');
    // initiate default objects.yml, index.md, includes/layout.html, generate.js
    fs.writeFileSync('objects.yml', `urlBase: http://localhost
titleBase: My Website - %title
base: ./build`);
    fs.writeFileSync('index.md', `---
parent: /includes/layout.html
title: Example home page
---
Hello world! Welcome to the **STExtended** static site generator!`);
    fs.mkdirSync('includes');
    fs.writeFileSync('includes/layout.html',`<!DOCTYPE html>
<html lang="en">
    <head>
        <title>{{ headTitle(page.title) }}</title>
        <link href="{% route '/style.css' %}" rel="stylesheet" />
    </head>
    <body>
        <Row justify-content="center" align-items="center">
            {{ children }}
        </Row>
    </body>
</html>`);
    fs.writeFileSync('generate.js', `const staticton = require('@jlpenny/staticton');
const elements = require('@jlpenny/stextended/elements');

const Generate = new staticton('.', 'objects.yml');

const { HTML, CSS } = elements(Generate);

Generate.all();`);
    fs.writeFileSync('package.json', `{
    "name": "new-website",
    "version": "1.0.0",
    "description": "",
    "main": "generate.js",
    "scripts": {
        "build": "node generate.js"
    },
    "author": "",
    "license": "MIT",
    "dependencies": {
        "staticton": "^0.0.1",
        "stextended": "^0.0.1"
    }
}
      `);
    console.log('All done! Edit objects.yml to adjust your site options!');
} else {
    console.log('Usage: stextended init [dirname]');
}
SHELL := /bin/bash

init:
	nvm use && npm init

install:
	npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

compile:
	npx hardhat compile

tests:
	npx hardhat test

console:
	npx hardhat console

testnet_deploy:
	npx hardhat run scripts/testnet_deploy.js

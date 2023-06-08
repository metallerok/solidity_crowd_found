const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 contract", () => {
    async function deployContractFixture() {
        const [creator, client1, client2] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("ERC20");
        const token = await Token.deploy(1000000);

        return {Token, token, creator, client1, client2};
    };
    
    it("Test contract creation without minting", async () => {
        const [creator] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("ERC20");
        const token = await Token.deploy(0);
        
        const transferEventFilter = token.filters.Transfer()
        const events = await token.queryFilter(transferEventFilter);
        
        assert(events.length == 0);

        expect(await token.totalSupply()).to.be.equal(0);
        expect(await token.owner()).to.be.equal(creator.address);
        expect(await token.balanceOf(creator)).to.be.equal(0);
    });
    
    it("Test contract creation", async () => {
        const [creator] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("ERC20");
        const token = await Token.deploy(10000);
        
        const transferEventFilter = token.filters.Transfer()
        const events = await token.queryFilter(transferEventFilter);
        
        assert(events.length == 1);
        expect(events[0].args[0]).to.be.equal(ethers.ZeroAddress);
        expect(events[0].args[1]).to.be.equal(creator.address);
        expect(events[0].args[2]).to.be.equal(10000);

        expect(await token.totalSupply()).to.be.equal(10000);
        expect(await token.owner()).to.be.equal(creator.address);
        expect(await token.balanceOf(creator)).to.be.equal(10000);
    });
    
    it("Test minting", async () => {
        const {token, creator} = await loadFixture(deployContractFixture);

        // 10k tokens by fixture contract
        expect(await token.totalSupply()).to.be.equal(1000000);
        expect(await token.balanceOf(creator)).to.be.equal(1000000);
        
        // mint 100.00 tokens
        await expect(token.mint(10000))
            .to.emit(token, "Transfer")
            .withArgs(ethers.ZeroAddress, creator.address, 10000);
        
        // now total supply 10.1k tokens
        expect(await token.totalSupply()).to.be.equal(1010000);
        expect(await token.balanceOf(creator)).to.be.equal(1010000);
    });
    
    it("Try minting tokens not from owner", async () => {
        const {token, creator, client1} = await loadFixture(deployContractFixture);

        // 10k tokens by fixture contract
        expect(await token.totalSupply()).to.be.equal(1000000);
        expect(await token.balanceOf(creator)).to.be.equal(1000000);
        
        await expect(token.connect(client1).mint(10000))
            .to.be.revertedWith("Only owner")
        
        expect(await token.totalSupply()).to.be.equal(1000000);
        expect(await token.balanceOf(creator)).to.be.equal(1000000);
    });
    
    it("Test transfer tokens", async () => {
        const {token, creator, client1} = await loadFixture(deployContractFixture);

        expect(await token.balanceOf(creator)).to.be.equal(1000000);
        
        await expect(token.transfer(client1.address, 10000))
            .to.emit(token, "Transfer")
            .withArgs(creator.address, client1.address, 10000);
        
        expect(await token.balanceOf(creator)).to.be.equal(990000);
        expect(await token.balanceOf(client1)).to.be.equal(10000);
    });
    
    it("Test approve tokens transfer", async () => {
        const {token, creator, client1, client2} = await loadFixture(deployContractFixture);
        
        await expect(
            token.connect(client1).transferFrom(creator.address, client2.address, 10000)
        ).to.be.reverted;
        
        await expect(token.approve(client1.address, 10000))
            .to.emit(token, "Approval")
            .withArgs(creator.address, client1.address, 10000);

        await expect(
            token.connect(client1).transferFrom(creator.address, client2.address, 10000)
        ).to.emit(token, "Transfer")
            .withArgs(creator.address, client2.address, 10000);
        
        expect(await token.balanceOf(creator)).to.be.equal(990000);
        expect(await token.balanceOf(client1)).to.be.equal(0);
        expect(await token.balanceOf(client2)).to.be.equal(10000);
    });
    
    it("Test burn tokens", async () => {
        const {token, creator} = await loadFixture(deployContractFixture);
        
        expect(await token.balanceOf(creator)).to.be.equal(1000000);
        
        await expect(token.burn(10000))
            .to.emit(token, "Transfer")
            .withArgs(creator.address, ethers.ZeroAddress, 10000);
        
        expect(await token.balanceOf(creator)).to.be.equal(990000);
        expect(await token.totalSupply()).to.be.equal(990000);
    });
});

const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { assert, expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenCrowd contract", () => {
    async function deployTokenContractFixture() {
        const [tokenCreator, client1, client2] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("ERC20");
        const token = await Token.deploy(1000000);

        return {Token, token, tokenCreator, client1, client2};
    };
    
    async function deployCrowdFoundContractFixture(token) {
        const setupChildFixtureInternal = async () => {
            const [crowdFoundCreator] = await ethers.getSigners();

            const CrowdFound = await ethers.getContractFactory("CrowdFound");
            const crowdFound = await CrowdFound.deploy(await token.getAddress());
            
            return {CrowdFound, crowdFound, crowdFoundCreator};
        };
        
        return setupChildFixtureInternal;
    };
    
    it("Test contract creation", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        expect(await crowdFound.token()).to.be.equal(await token.getAddress());
    });
    
    it("Try launch crowdfound but StartAt < now", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now - 100;
        const endAt = now + 100;
        
        await expect(crowdFound.launch(10000, startAt, endAt)).to.be.revertedWith("StartAt < now");
    });
    
    it("Try launch crowdfound but EndAt < StartAt", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now - 100;
        
        await expect(crowdFound.launch(10000, startAt, endAt)).to.be.revertedWith("EndAt < StartAt");
    });
    
    it("Try launch crowdfound but EndAt > compaign duration", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 2678400; // now + 31 day
        
        await expect(crowdFound.launch(10000, startAt, endAt)).to.be.revertedWith("EndAt > campaign duration");
    });
    
    it("Test launch crowdfound", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound, crowdFoundCreator} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;

        expect(await crowdFound.campaingsCount()).to.be.equal(0);

        await expect(crowdFound.launch(goal, startAt, endAt))
            .to.emit(crowdFound, "Launched")
            .withArgs(1, crowdFoundCreator.address, goal, startAt, endAt);

        expect(await crowdFound.campaingsCount()).to.be.equal(1);

        const campaign = await crowdFound.getCampaign(1);

        expect(campaign.creator).to.be.equal(crowdFoundCreator.address);
        expect(campaign.goal).to.be.equal(goal);
        expect(campaign.pledged).to.be.equal(0);
        expect(campaign.startAt).to.be.equal(startAt);
        expect(campaign.endAt).to.be.equal(endAt);
        expect(campaign.claimed).to.be.equal(false);
    });
    
    it("Try cancel campaign from not owner", async () => {
        const {token, client1} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.connect(client1).cancel(1)).to.be.revertedWith("Not creator");
    });
    
    it("Try cancel campaign but already started", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 2;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.cancel(1)).to.be.revertedWith("Already started");
    });
    
    it("Test cancel campaign", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.cancel(1))
            .to.emit(crowdFound, "Canceled")
            .withArgs(1);
        
        await expect(crowdFound.getCampaign(1)).to.be.revertedWith("Campaign not found");
    });
    
    it("Try pledge campaign but not started", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.pledge(1, 1000)).to.be.revertedWith("Not started");
    });
    
    it("Try pledge campaign but already ended", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 200;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        
        await time.increase(3600);

        await expect(crowdFound.pledge(1, 1000)).to.be.revertedWith("Already ended");
    });
    
    it("Test pledge campaign", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 200;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(100);

        await expect(crowdFound.connect(tokenCreator).pledge(1, 1000))
            .to.emit(crowdFound, "Pledged")
            .withArgs(1, tokenCreator.address, 1000);

        const campaign = await crowdFound.getCampaign(1);

        expect(campaign.pledged).to.be.equal(1000);
    });
    
    it("Try unpledge campaign but already ended", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 200;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        
        await time.increase(3600);

        await expect(crowdFound.unpledge(1, 1000)).to.be.revertedWith("Already ended");
    });
    
    it("Test unpledge campaign", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 200;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(100);

        await expect(crowdFound.connect(tokenCreator).pledge(1, 1000)).not.to.be.reverted;
        await expect(crowdFound.connect(tokenCreator).unpledge(1, 1000))
            .to.emit(crowdFound, "Unpledged")
            .withArgs(1, tokenCreator.address, 1000);

        const campaign = await crowdFound.getCampaign(1);

        expect(campaign.pledged).to.be.equal(0);
    });
    
    it("Try claim campaign from not creator", async () => {
        const {token, client1} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.connect(client1).claim(1)).to.be.revertedWith("Not creator");
    });
    
    it("Try claim campaign but not ended", async () => {
        const {token, client1} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.claim(1)).to.be.revertedWith("Not ended");
    });
    
    it("Try claim campaign goal not reached", async () => {
        const {token, client1} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(350);
        await expect(crowdFound.claim(1)).to.be.revertedWith("Pledged < goal");
    });
    
    it("Test claim campaign", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound, crowdFoundCreator} = await loadFixture(await deployCrowdFoundContractFixture(token));
        
        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(150); // move to start campaign
        await crowdFound.connect(tokenCreator).pledge(1, 10000);
        await time.increase(200); // move after end campaign

        expect(await token.balanceOf(crowdFoundCreator.address)).to.be.equal(990000);

        await expect(crowdFound.claim(1))
            .to.emit(crowdFound, "Claimed")
            .withArgs(1)
        
        const campaign = await crowdFound.getCampaign(1);

        expect(campaign.pledged).to.be.equal(10000);
        expect(campaign.claimed).to.be.equal(true);
        
        expect(await token.balanceOf(crowdFoundCreator.address)).to.be.equal(1000000);
    });
    
    it("Try claim campaign but already claimed", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));
        
        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(150); // move to start campaign
        await crowdFound.connect(tokenCreator).pledge(1, 10000);
        await time.increase(200); // move after end campaign

        await crowdFound.claim(1);

        await expect(crowdFound.claim(1)).to.be.revertedWith("Already claimed");
    });
    
    it("Try refund but not ended", async () => {
        const {token} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await expect(crowdFound.refund(1)).to.be.revertedWith("Not ended");
    });
    
    it("Try refund but goal completed", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));
        
        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(150);
        await crowdFound.connect(tokenCreator).pledge(1, 10000);
        await time.increase(200);
        
        await expect(crowdFound.refund(1)).to.be.revertedWith("Goal completed");
    });
    
    it("Test refund", async () => {
        const {token, tokenCreator} = await loadFixture(deployTokenContractFixture);
        const {crowdFound} = await loadFixture(await deployCrowdFoundContractFixture(token));
        
        token.approve(await crowdFound.getAddress(), 10000);

        const now = Math.floor((new Date()).getTime() / 1000);
        const startAt = now + 100;
        const endAt = now + 300;
        const goal = 10000;
        
        await crowdFound.launch(goal, startAt, endAt);
        await time.increase(150);
        await crowdFound.connect(tokenCreator).pledge(1, 1000);
        await time.increase(200);
        
        await expect(crowdFound.refund(1))
            .to.emit(crowdFound, "Refunded")
            .withArgs(1, tokenCreator.address, 1000);
    });
});
    
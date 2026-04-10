import { expect } from "chai";
import { ethers } from "hardhat";
import { Chiesa, DistributionLogic, MockToken, MockAave } from "../typechain";

describe("Igreja Smart Contract Suite", function () {
  let chiesa: Chiesa;
  let distributionLogic: DistributionLogic;
  let mockUSDC: MockToken;
  let mockAave: MockAave;
  let owner: any;
  let donor1: any;
  let donor2: any;

  beforeEach(async function () {
    [owner, donor1, donor2] = await ethers.getSigners();

    // Deploy mock token (USDC)
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockUSDC = await MockTokenFactory.deploy("USDC", "USDC", 6);
    await mockUSDC.deployed();

    // Deploy mock Aave
    const MockAaveFactory = await ethers.getContractFactory("MockAave");
    mockAave = await MockAaveFactory.deploy();
    await mockAave.deployed();

    // Deploy DistributionLogic
    const DistributionLogicFactory = await ethers.getContractFactory("DistributionLogic");
    distributionLogic = await DistributionLogicFactory.deploy();
    await distributionLogic.deployed();

    // Deploy Chiesa
    const ChiesaFactory = await ethers.getContractFactory("Chiesa");
    chiesa = await ChiesaFactory.deploy(
      mockUSDC.address,
      mockAave.address,
      owner.address,
      distributionLogic.address
    );
    await chiesa.deployed();

    // Distribute tokens to donors
    await mockUSDC.transfer(donor1.address, ethers.utils.parseUnits("1000", 6));
    await mockUSDC.transfer(donor2.address, ethers.utils.parseUnits("1000", 6));
  });

  describe("Donations", function () {
    it("Should accept donations", async function () {
      const donationAmount = ethers.utils.parseUnits("100", 6);

      // Approve and donate
      await mockUSDC.connect(donor1).approve(chiesa.address, donationAmount);
      await chiesa.connect(donor1).donate(donationAmount);

      expect(await chiesa.totalDonations()).to.eql(donationAmount);
      expect(await chiesa.donationsByUser(donor1.address)).to.eql(donationAmount);
    });

    it("Should track multiple donations", async function () {
      const amount1 = ethers.utils.parseUnits("100", 6);
      const amount2 = ethers.utils.parseUnits("200", 6);

      // First donation
      await mockUSDC.connect(donor1).approve(chiesa.address, amount1);
      await chiesa.connect(donor1).donate(amount1);

      // Second donation from same donor
      await mockUSDC.connect(donor1).approve(chiesa.address, amount2);
      await chiesa.connect(donor1).donate(amount2);

      expect(await chiesa.donationsByUser(donor1.address)).to.eql(amount1.add(amount2));
      expect(await chiesa.totalDonations()).to.eql(amount1.add(amount2));
    });

    it("Should register donors", async function () {
      const donationAmount = ethers.utils.parseUnits("100", 6);

      await mockUSDC.connect(donor1).approve(chiesa.address, donationAmount);
      await chiesa.connect(donor1).donate(donationAmount);

      const donorCount = await chiesa.getDonorCount();
      expect(donorCount.toNumber()).to.equal(1);

      const donors = await chiesa.getDonors();
      expect(donors[0]).to.equal(donor1.address);
    });

    it("Should reject zero donation", async function () {
      try {
        await chiesa.connect(donor1).donate(0);
        throw new Error("Expected revert");
      } catch (error: any) {
        expect(error.message).to.include("Amount must be greater than 0");
      }
    });
  });

  describe("Yield Management", function () {
    it("Should allow owner to deposit to Aave", async function () {
      const depositAmount = ethers.utils.parseUnits("500", 6);

      // First, receive donation
      await mockUSDC.transfer(chiesa.address, depositAmount);

      // Approve and deposit
      await chiesa.depositToAave(depositAmount);

      // Verify deposit was recorded in mock Aave
      // In real scenario, we'd check aToken balance
    });

    it("Should only allow owner to deposit", async function () {
      const depositAmount = ethers.utils.parseUnits("500", 6);

      try {
        await chiesa.connect(donor1).depositToAave(depositAmount);
        throw new Error("Expected revert");
      } catch (error: any) {
        expect(error.message).to.include("Ownable");
      }
    });
  });

  describe("Distribution Logic", function () {
    it("Should calculate correct distribution percentages", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      const churchPercent = await distributionLogic.churchPercentage();

      const result = await distributionLogic.calculatePercentage(amount, churchPercent);
      expect(result).to.eql(ethers.utils.parseUnits("600", 6));
    });

    it("Should allow owner to update distribution", async function () {
      await distributionLogic.setDistributionPercentages(70, 20, 10);

      const churchPct = await distributionLogic.churchPercentage();
      const donorPct = await distributionLogic.donorRewardPercentage();
      const reservePct = await distributionLogic.reservePercentage();

      expect(churchPct.toNumber()).to.equal(70);
      expect(donorPct.toNumber()).to.equal(20);
      expect(reservePct.toNumber()).to.equal(10);
    });

    it("Should reject invalid distribution percentages", async function () {
      try {
        await distributionLogic.setDistributionPercentages(50, 30, 10);
        throw new Error("Expected revert");
      } catch (error: any) {
        expect(error.message).to.include("Percentages must sum to 100");
      }
    });
  });

  describe("Access Control", function () {
    it("Should pause/unpause contract", async function () {
      await chiesa.pause();
      expect(await chiesa.paused()).to.be.true;

      const donationAmount = ethers.utils.parseUnits("100", 6);
      await mockUSDC.connect(donor1).approve(chiesa.address, donationAmount);

      try {
        await chiesa.connect(donor1).donate(donationAmount);
        throw new Error("Expected revert");
      } catch (error: any) {
        expect(error.message).to.include("paused");
      }

      await chiesa.unpause();
      expect(await chiesa.paused()).to.be.false;
    });
  });
});

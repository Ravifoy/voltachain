const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VoltaChain", () => {
  let c, admin, inspector, seller, buyer;
  const hash = ethers.keccak256(ethers.toUtf8Bytes("report-1"));

  beforeEach(async () => {
    [admin, inspector, seller, buyer] = await ethers.getSigners();
    c = await (await ethers.getContractFactory("VoltaChain")).deploy();
    await c.addInspector(inspector.address);
    await c.connect(seller).registerBattery("SN-1", "Li-ion 18650", 3000);
  });

  it("registers a battery and mints NFT to caller", async () => {
    expect(await c.ownerOf(1)).to.equal(seller.address);
    expect((await c.getBattery(1)).serialNumber).to.equal("SN-1");
  });

  it("rejects duplicate serial numbers", async () => {
    await expect(c.connect(buyer).registerBattery("SN-1", "x", 1)).to.be.revertedWith("Serial already registered");
  });

  it("only admin can add inspectors", async () => {
    await expect(c.connect(seller).addInspector(seller.address)).to.be.reverted;
    await expect(c.addInspector(buyer.address)).to.emit(c, "InspectorAdded").withArgs(buyer.address);
  });

  it("inspector can add a report; non-inspector is rejected", async () => {
    await expect(c.connect(inspector).addHealthReport(1, 82, "B", 300, hash))
      .to.emit(c, "HealthReportAdded").withArgs(1, hash, inspector.address);
    const r = await c.getReports(1);
    expect(r.length).to.equal(1);
    expect(r[0].reportHash).to.equal(hash);
    expect(r[0].inspector).to.equal(inspector.address);
    await expect(c.connect(seller).addHealthReport(1, 99, "A", 1, hash))
      .to.be.revertedWith("Only verified inspectors can add reports");
  });

  it("cannot list without a report, only owner can list", async () => {
    await expect(c.connect(seller).listForSale(1, 100)).to.be.revertedWith("Needs at least one health report");
    await c.connect(inspector).addHealthReport(1, 82, "B", 300, hash);
    await expect(c.connect(buyer).listForSale(1, 100)).to.be.revertedWith("Only owner can list");
    await expect(c.connect(seller).listForSale(1, 100)).to.emit(c, "Listed");
    expect(await c.getActiveListings()).to.deep.equal([1n]);
  });

  it("owners can set a display name and battery location", async () => {
    await expect(c.connect(seller).setName("GreenCell")).to.emit(c, "NameSet").withArgs(seller.address, "GreenCell");
    expect(await c.displayName(seller.address)).to.equal("GreenCell");
    await expect(c.connect(seller).setName("")).to.be.revertedWith("Name must be 1-32 characters");
    await expect(c.connect(buyer).setLocation(1, "Pune", 18520400, 73856700)).to.be.revertedWith("Only owner can set location");
    await expect(c.connect(seller).setLocation(1, "Pune", 18520400, 73856700)).to.emit(c, "LocationSet").withArgs(1, "Pune");
    const loc = await c.getLocation(1);
    expect(loc.city).to.equal("Pune");
    expect(loc.isSet).to.equal(true);
    await expect(c.connect(seller).setLocation(1, "X", 99000000, 0)).to.be.revertedWith("Bad coordinates");
  });

  it("owner can attach a photo hash; others cannot", async () => {
    const h = ethers.keccak256(ethers.toUtf8Bytes("photo"));
    await expect(c.connect(buyer).setImage(1, h)).to.be.revertedWith("Only owner can set photo");
    await expect(c.connect(seller).setImage(1, ethers.ZeroHash)).to.be.revertedWith("Photo hash required");
    await expect(c.connect(seller).setImage(1, h)).to.emit(c, "ImageSet").withArgs(1, h);
    expect(await c.getImageHash(1)).to.equal(h);
  });

  it("buy transfers NFT, pays seller, records history", async () => {
    await c.connect(inspector).addHealthReport(1, 82, "B", 300, hash);
    const price = ethers.parseEther("1");
    await c.connect(seller).listForSale(1, price);
    await expect(c.connect(buyer).buy(1, { value: price / 2n })).to.be.revertedWith("Send the exact price");
    await expect(() => c.connect(buyer).buy(1, { value: price }))
      .to.changeEtherBalances([buyer, seller], [-price, price]);
    expect(await c.ownerOf(1)).to.equal(buyer.address);
    const hist = await c.getOwnerHistory(1);
    expect(hist.map((h) => h.owner)).to.deep.equal([seller.address, buyer.address]);
    expect((await c.getListing(1)).active).to.equal(false);
    await expect(c.connect(admin).buy(1, { value: price })).to.be.revertedWith("Not for sale");
  });
});

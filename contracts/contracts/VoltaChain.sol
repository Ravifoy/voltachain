// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VoltaChain
 * @notice Second-hand battery marketplace. Each battery is an ERC-721 NFT.
 *         Health reports can ONLY be added by verified inspectors ("oracle problem":
 *         a blockchain cannot verify real-world data itself, so we trust signed
 *         submissions from approved inspectors). Only the keccak256 hash of the full
 *         report JSON is stored on-chain; anyone can re-hash the off-chain JSON to
 *         prove it was not tampered with.
 */
contract VoltaChain is ERC721, Ownable, ReentrancyGuard {
    // ---------- Data structures ----------
    struct Battery {
        uint256 tokenId;
        string serialNumber;
        string batteryType;     // e.g. "Li-ion 18650"
        uint256 capacityMah;    // nominal capacity
        uint256 registeredAt;
    }

    struct HealthReport {
        uint256 sohPercent;     // state of health, 0-100
        string grade;           // "A".."D"
        uint256 cycleCount;
        bytes32 reportHash;     // keccak256 of full report JSON (stored off-chain)
        address inspector;
        uint256 timestamp;
        uint256 blockNumber;
    }

    struct OwnerRecord {
        address owner;
        uint256 timestamp;
        uint256 blockNumber;
    }

    /// @dev Where the battery is (picked by its owner). Coordinates are degrees x 1e6.
    struct Location {
        string city;
        int256 latE6;
        int256 lngE6;
        bool isSet;
    }

    struct Listing {
        uint256 price;          // in wei
        bool active;
    }

    // ---------- Storage ----------
    uint256 private _nextTokenId = 1;
    mapping(address => bool) public isInspector;
    mapping(bytes32 => bool) private _serialUsed;       // enforces unique serial numbers
    mapping(uint256 => Battery) private _batteries;
    mapping(uint256 => HealthReport[]) private _reports;
    mapping(uint256 => OwnerRecord[]) private _ownerHistory;
    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => Location) private _locations;
    mapping(uint256 => bytes32) private _imageHash;     // keccak256 of the battery photo (photo itself is off-chain)
    mapping(address => string) public displayName;      // optional human-readable name per wallet

    // ---------- Events ----------
    event InspectorAdded(address indexed inspector);
    event BatteryRegistered(uint256 indexed tokenId, address indexed owner, string serialNumber);
    event HealthReportAdded(uint256 indexed tokenId, bytes32 reportHash, address indexed inspector);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Sold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event NameSet(address indexed user, string name);
    event LocationSet(uint256 indexed tokenId, string city);
    event ImageSet(uint256 indexed tokenId, bytes32 imageHash);

    constructor() ERC721("VoltaChain Battery", "VOLT") Ownable(msg.sender) {}

    // ---------- Admin ----------
    /// @notice Admin approves a new inspector.
    function addInspector(address inspector) external onlyOwner {
        isInspector[inspector] = true;
        emit InspectorAdded(inspector);
    }

    // ---------- Profiles ----------
    /// @notice Anyone can attach a display name to their own wallet (public, not verified).
    function setName(string calldata name) external {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name must be 1-32 characters");
        displayName[msg.sender] = name;
        emit NameSet(msg.sender, name);
    }

    /// @notice Owner sets where the battery is located (shown on the marketplace map).
    function setLocation(uint256 tokenId, string calldata city, int256 latE6, int256 lngE6) external {
        require(ownerOf(tokenId) == msg.sender, "Only owner can set location");
        require(latE6 >= -90_000_000 && latE6 <= 90_000_000 && lngE6 >= -180_000_000 && lngE6 <= 180_000_000, "Bad coordinates");
        require(bytes(city).length > 0 && bytes(city).length <= 48, "City must be 1-48 characters");
        _locations[tokenId] = Location(city, latE6, lngE6, true);
        emit LocationSet(tokenId, city);
    }

    /// @notice Owner attaches a photo fingerprint. Anyone can re-hash the photo to check it was not swapped.
    function setImage(uint256 tokenId, bytes32 imageHash) external {
        require(ownerOf(tokenId) == msg.sender, "Only owner can set photo");
        require(imageHash != bytes32(0), "Photo hash required");
        _imageHash[tokenId] = imageHash;
        emit ImageSet(tokenId, imageHash);
    }

    // ---------- Seller ----------
    /// @notice Register a battery; mints the NFT to the caller. Serial must be unique.
    function registerBattery(string calldata serialNumber, string calldata batteryType, uint256 capacityMah)
        external returns (uint256 tokenId)
    {
        require(bytes(serialNumber).length > 0, "Serial required");
        bytes32 key = keccak256(bytes(serialNumber));
        require(!_serialUsed[key], "Serial already registered");
        _serialUsed[key] = true;

        tokenId = _nextTokenId++;
        _batteries[tokenId] = Battery(tokenId, serialNumber, batteryType, capacityMah, block.timestamp);
        _safeMint(msg.sender, tokenId); // _update hook records first owner
        emit BatteryRegistered(tokenId, msg.sender, serialNumber);
    }

    // ---------- Inspector ----------
    /// @notice Only verified inspectors may attach a health report.
    function addHealthReport(
        uint256 tokenId,
        uint256 sohPercent,
        string calldata grade,
        uint256 cycleCount,
        bytes32 reportHash
    ) external {
        require(isInspector[msg.sender], "Only verified inspectors can add reports");
        _requireOwned(tokenId);
        require(sohPercent <= 100, "SoH must be 0-100");
        _reports[tokenId].push(
            HealthReport(sohPercent, grade, cycleCount, reportHash, msg.sender, block.timestamp, block.number)
        );
        emit HealthReportAdded(tokenId, reportHash, msg.sender);
    }

    // ---------- Marketplace ----------
    /// @notice Owner lists a battery that has at least one health report.
    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Only owner can list");
        require(_reports[tokenId].length > 0, "Needs at least one health report");
        require(price > 0, "Price must be > 0");
        _listings[tokenId] = Listing(price, true);
        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Buyer pays the exact price; NFT moves to buyer, ETH goes straight to seller.
    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory l = _listings[tokenId];
        require(l.active, "Not for sale");
        require(msg.value == l.price, "Send the exact price");
        address seller = ownerOf(tokenId);
        require(seller != msg.sender, "Cannot buy your own battery");

        // Effects first (the _update hook also clears the listing)
        _transfer(seller, msg.sender, tokenId);

        // Interaction: pay the seller directly
        (bool ok, ) = payable(seller).call{value: msg.value}("");
        require(ok, "Payment failed");
        emit Sold(tokenId, seller, msg.sender, l.price);
    }

    /// @dev Called on mint and every transfer: record ownership history, cancel any listing.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        _ownerHistory[tokenId].push(OwnerRecord(to, block.timestamp, block.number));
        delete _listings[tokenId];
    }

    // ---------- Views ----------
    function totalBatteries() external view returns (uint256) { return _nextTokenId - 1; }

    function getBattery(uint256 tokenId) external view returns (Battery memory) {
        _requireOwned(tokenId);
        return _batteries[tokenId];
    }

    function getAllBatteries() external view returns (Battery[] memory list) {
        uint256 n = _nextTokenId - 1;
        list = new Battery[](n);
        for (uint256 i = 1; i <= n; i++) list[i - 1] = _batteries[i];
    }

    function getReports(uint256 tokenId) external view returns (HealthReport[] memory) { return _reports[tokenId]; }

    function getOwnerHistory(uint256 tokenId) external view returns (OwnerRecord[] memory) { return _ownerHistory[tokenId]; }

    function getImageHash(uint256 tokenId) external view returns (bytes32) { return _imageHash[tokenId]; }

    function getLocation(uint256 tokenId) external view returns (Location memory) { return _locations[tokenId]; }

    function getListing(uint256 tokenId) external view returns (Listing memory) { return _listings[tokenId]; }

    /// @notice Token ids of all batteries currently for sale.
    function getActiveListings() external view returns (uint256[] memory ids) {
        uint256 n = _nextTokenId - 1;
        uint256 count;
        for (uint256 i = 1; i <= n; i++) if (_listings[i].active) count++;
        ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= n; i++) if (_listings[i].active) ids[j++] = i;
    }
}

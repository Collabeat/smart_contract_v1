// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./CollaNFT.sol";

interface CollaAirnode {
    function makeRequest(
        address,
        bytes32,
        address,
        address,
        bytes calldata
    ) external;
}

contract CollaUtility is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 constant ADDRESS_LENGTH = 42;

    uint public mintPrice;
    address public nftAddress;

    address public airnode;
    address public sponsor;
    address public sponsorWallet;
    bytes32 public endpointId;
    address public requester;

    address public protocolWallet;

    uint public percentProtocol = 5 * 1e16;
    uint public percentAirnode = 1 * 1e16;

    mapping(bytes32 => uint256) private requestFees;

    event NFTify(address from, uint tokenId, bytes data, uint deposit);

    constructor(
        address _nftAddress,
        address _protocolWallet,
        uint _mintPrice,
        address _airnode,
        address _sponsor,
        address _sponsorWallet,
        bytes32 _endpointId,
        address _requester
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        nftAddress = _nftAddress;
        protocolWallet = _protocolWallet;
        mintPrice = _mintPrice;

        airnode = _airnode;
        sponsor = _sponsor;
        sponsorWallet = _sponsorWallet;
        endpointId = _endpointId;
        requester = _requester;
        _grantRole(MINTER_ROLE, requester);
    }

    function setPercentage(
        uint _protocol,
        uint _airnode
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        percentProtocol = _protocol;
        percentAirnode = _airnode;
    }

    function setNftAddress(
        address _nftAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nftAddress = _nftAddress;
    }

    function setMintPrice(uint price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = price;
    }

    function setRequester(
        address _requester
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        requester = _requester;
        _grantRole(MINTER_ROLE, requester);
    }

    function setProtocolWallet(
        address _wallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        protocolWallet = _wallet;
    }

    function mintRequest(
        string memory dataKey,
        string memory version,
        string memory nftName,
        string memory ipfsAddress,
        string memory cid
    ) public payable {
        require(msg.value >= mintPrice, "Insufficient amount");

        uint protocolFee = (msg.value * percentProtocol) / 1e18;

        (bool success, ) = protocolWallet.call{value: protocolFee}("");
        require(success, "Unable to send to protocol address");

        uint airnodeCut = (msg.value * percentAirnode) / 1e18;
        (bool success3, ) = sponsorWallet.call{value: airnodeCut}("");
        require(success3, "Unable to send to airnode address");

        bytes32 requestId = keccak256(
            abi.encodePacked(
                dataKey,
                version,
                nftName,
                ipfsAddress,
                cid,
                block.timestamp
            )
        );

        requestFees[requestId] = msg.value - protocolFee - airnodeCut;

        bytes memory data = abi.encode(nftName, ipfsAddress, cid);
        bytes memory params = setParameters(dataKey, version, data, requestId);

        CollaAirnode(requester).makeRequest(
            airnode,
            endpointId,
            sponsor,
            sponsorWallet,
            params
        );
    }

    function requestFulfill(
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) {
        (
            bytes memory datas,
            address[] memory addresses,
            bytes32 requestId
        ) = decodeData(data);

        require(addresses.length > 0, "No addresses to mint");

        uint tokenId = CollaNFT(nftAddress).registerToken();

        bytes memory forkData = abi.encode("", datas);

        uint256 balanceFee = requestFees[requestId];
        uint256 feeForEachAddress = balanceFee / addresses.length;

        for (uint256 i = 0; i < addresses.length; i++) {
            CollaNFT(nftAddress).mint(addresses[i], tokenId, 1, forkData);
            (bool success, ) = payable(addresses[i]).call{
                value: feeForEachAddress
            }("");
            if (success) {
                emit NFTify(addresses[i], tokenId, forkData, feeForEachAddress);
                delete requestFees[requestId];
            }
        }
    }

    function setParameters(
        string memory dataKey,
        string memory version,
        bytes memory data,
        bytes32 requestId
    ) public pure returns (bytes memory) {
        bytes memory parameters = abi.encode(
            bytes32("1SSBb"),
            bytes32("data_key"),
            dataKey,
            bytes32("version"),
            version,
            bytes32("datas"),
            data,
            bytes32("request_id"),
            requestId
        );

        return parameters;
    }

    function setAirnode(
        address _airnode,
        address _sponsor,
        address _sponsorWallet,
        bytes32 _endpointId,
        address _requester
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        airnode = _airnode;
        sponsor = _sponsor;
        sponsorWallet = _sponsorWallet;
        endpointId = _endpointId;
        requester = _requester;

        _grantRole(MINTER_ROLE, requester);
    }

    function decodeData(
        bytes calldata encodedData
    ) public pure returns (bytes memory, address[] memory, bytes32) {
        (bytes memory datas, string memory addresses, bytes32 requestId) = abi
            .decode(encodedData, (bytes, string, bytes32));

        address[] memory convertAddress = splitAndConvert(addresses);
        return (datas, convertAddress, requestId);
    }

    function splitAndConvert(
        string memory concatenatedAddresses
    ) public pure returns (address[] memory) {
        uint256 addressesCount = bytes(concatenatedAddresses).length /
            ADDRESS_LENGTH;
        address[] memory addresses = new address[](addressesCount);

        for (uint256 i = 0; i < addressesCount; i++) {
            string memory addressStr = substring(
                concatenatedAddresses,
                i * ADDRESS_LENGTH,
                (i + 1) * ADDRESS_LENGTH - 1
            );
            addresses[i] = parseAddress(addressStr);
        }

        return addresses;
    }

    function substring(
        string memory str,
        uint256 start,
        uint256 end
    ) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start + 1);
        for (uint256 i = start; i <= end; i++) {
            result[i - start] = strBytes[i];
        }
        return string(result);
    }

    function parseAddress(
        string memory _addressString
    ) public pure returns (address) {
        bytes memory _addressBytes = bytes(_addressString);
        require(_addressBytes.length == 42, "Invalid address length");

        uint160 _parsedAddress = 0;

        for (uint256 i = 2; i < _addressBytes.length; i++) {
            _parsedAddress *= 16;

            uint8 _digit = uint8(_addressBytes[i]);
            if (_digit >= 48 && _digit <= 57) {
                _parsedAddress += _digit - 48;
            } else if (_digit >= 65 && _digit <= 70) {
                _parsedAddress += _digit - 55;
            } else if (_digit >= 97 && _digit <= 102) {
                _parsedAddress += _digit - 87;
            } else {
                revert("Invalid character in address string");
            }
        }

        return address(_parsedAddress);
    }
}

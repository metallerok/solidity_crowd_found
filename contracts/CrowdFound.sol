// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import "./IERC20.sol";

contract CrowdFound {
    event Launched(
        uint id,
        address indexed creator,
        uint goal,
        uint32 startAt,
        uint32 endAt
    );
    event Canceled(uint id);
    event Pledged(uint indexed id, address indexed caller, uint amount);
    event Unpledged(uint indexed id, address indexed caller, uint amount);
    event Refunded(uint indexed id, address indexed caller, uint amount);
    event Claimed(uint id);

    struct Campaign {
        address creator;
        uint goal;
        uint pledged;
        uint32 startAt;
        uint32 endAt;
        bool claimed;
    }

    IERC20 public immutable token;
    uint public campaingsCount;
    mapping(uint => Campaign) public campaigns;
    mapping(uint => mapping(address => uint)) public pledgedAmount;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function launch(uint _goal, uint32 _startAt, uint32 _endAt) external {
        require(_startAt >= block.timestamp, "StartAt < now");
        require(_endAt >= _startAt, "EndAt < StartAt");
        require(_endAt <= block.timestamp + 30 days, "EndAt > compaign duration");

        campaingsCount += 1;
        campaigns[campaingsCount] = Campaign({
            creator: msg.sender,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });

        emit Launched(campaingsCount, msg.sender, _goal, _startAt, _endAt);
    }

    function cancel(uint _id) external {
        Campaign memory campaign = campaigns[_id];

        require(campaign.creator == msg.sender, "Not creator");
        require(block.timestamp < campaign.startAt, "Already started");

        delete campaigns[_id];

        emit Canceled(_id);
    }

    function pledge(uint _id, uint _amount) external {
        Campaign storage campaign = campaigns[_id];

        require(block.timestamp >= campaign.startAt, "Not started");
        require(block.timestamp <= campaign.endAt, "Already ended");

        campaign.pledged += _amount;
        pledgedAmount[_id][msg.sender] += _amount;
        token.transferFrom(msg.sender, address(this), _amount);

        emit Pledged(_id, msg.sender, _amount);
    }

    function unpledge(uint _id, uint _amount) external {
        Campaign storage campaign = campaigns[_id];

        require(block.timestamp <= campaign.endAt, "Already ended");
        
        campaign.pledged -= _amount;
        pledgedAmount[_id][msg.sender] -= _amount;
        token.transfer(msg.sender, _amount);

        emit Unpledged(_id, msg.sender, _amount);
    }

    function claim(uint _id) external {
        Campaign storage campaign = campaigns[_id];

        require(campaign.creator == msg.sender, "Not creator");
        require(block.timestamp > campaign.endAt, "Not ended");
        require(campaign.pledged >= campaign.goal, "Pledged < goal");
        require(!campaign.claimed, "Already claimed");

        campaign.claimed = true;
        token.transfer(campaign.creator, campaign.pledged);

        emit Claimed(_id);
    }

    function refund(uint _id) external {
        Campaign memory campaign = campaigns[_id];
        
        require(block.timestamp > campaign.endAt, "Not ended");
        require(campaign.pledged < campaign.goal, "Goal completed");

        uint balance = pledgedAmount[_id][msg.sender];
        pledgedAmount[_id][msg.sender] = 0;
        token.transfer(msg.sender, balance);

        emit Refunded(_id, msg.sender, balance);
    }
}

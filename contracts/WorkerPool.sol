pragma solidity ^0.4.21;

import './OwnableOZ.sol';
import './IexecHubAccessor.sol';
import './MarketplaceAccessor.sol';
import './IexecHub.sol';
import "./SafeMathOZ.sol";
import "./WorkOrder.sol";
import "./Marketplace.sol";
import './IexecLib.sol';

contract WorkerPool is OwnableOZ, IexecHubAccessor, MarketplaceAccessor // Owned by a S(w)
{
	using SafeMathOZ for uint256;


	/**
	 * Members
	 */
	string                      public m_description;
	uint256                     public m_stakeRatioPolicy;               // % of reward to stake
	uint256                     public m_schedulerRewardRatioPolicy;     // % of reward given to scheduler
	uint256                     public m_subscriptionLockStakePolicy;    // Stake locked when in workerpool - Constant set by constructor, do not update
	uint256                     public m_subscriptionMinimumStakePolicy; // Minimum stake for subscribing
	uint256                     public m_subscriptionMinimumScorePolicy; // Minimum score for subscribing
	address[]                   public m_workers;
	mapping(address => uint256) public m_workerIndex;

	// mapping(woid => IexecLib.Consensus)
	mapping(address => IexecLib.Consensus) public m_consensus;
	// mapping(woid => worker address => Contribution);
	mapping(address => mapping(address => IexecLib.Contribution)) public m_contributions;

	uint256 public constant REVEAL_PERIOD_DURATION_RATIO  = 2;
	uint256 public constant CONSENSUS_DURATION_RATIO      = 10;

	/**
	 * Address of slave/related contracts
	 */
	address        public  m_workerPoolHubAddress;


	/**
	 * Events
	 */
	event WorkerPoolPolicyUpdate(
		uint256 oldStakeRatioPolicy,               uint256 newStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy,     uint256 newSchedulerRewardRatioPolicy,
		uint256 oldSubscriptionMinimumStakePolicy, uint256 newSubscriptionMinimumStakePolicy,
		uint256 oldSubscriptionMinimumScorePolicy, uint256 newSubscriptionMinimumScorePolicy);

	event WorkOrderActive         (address indexed woid);
	event AllowWorkerToContribute (address indexed woid, address indexed worker, uint256 workerScore);
	event Contribute              (address indexed woid, address indexed worker, bytes32 resultHash);
	event RevealConsensus         (address indexed woid, bytes32 consensus);
	event Reveal                  (address indexed woid, address indexed worker, bytes32 result);

	event WorkerSubscribe         (address indexed worker);
	event WorkerUnsubscribe       (address indexed worker);
	event WorkerEviction          (address indexed worker);

	/**
	 * Modifiers
	 */
	modifier onlyWorkerPoolHub()
	{
		require(msg.sender == m_workerPoolHubAddress);
		_;
	}

	/**
	 * Methods
	 */
	// Constructor
	function WorkerPool(
		address _iexecHubAddress,
		string  _description,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy,
		address _marketplaceAddress)
	IexecHubAccessor(_iexecHubAddress)
	MarketplaceAccessor(_marketplaceAddress)
	public
	{
		// tx.origin == owner
		// msg.sender ==  WorkerPoolHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		m_description                    = _description;
		m_stakeRatioPolicy               = 30; // % of the work order price to stake
		m_schedulerRewardRatioPolicy     = 1;  // % of the work reward going to scheduler vs workers reward
		m_subscriptionLockStakePolicy    = _subscriptionLockStakePolicy; // only at creation. cannot be change to respect lock/unlock of worker stake
		m_subscriptionMinimumStakePolicy = _subscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _subscriptionMinimumScorePolicy;
		m_workerPoolHubAddress           = msg.sender;

	}

	function changeWorkerPoolPolicy(
		uint256 _newStakeRatioPolicy,
		uint256 _newSchedulerRewardRatioPolicy,
		uint256 _newSubscriptionMinimumStakePolicy,
		uint256 _newSubscriptionMinimumScorePolicy)
	public onlyOwner
	{
		emit WorkerPoolPolicyUpdate(
			m_stakeRatioPolicy,               _newStakeRatioPolicy,
			m_schedulerRewardRatioPolicy,     _newSchedulerRewardRatioPolicy,
			m_subscriptionMinimumStakePolicy, _newSubscriptionMinimumStakePolicy,
			m_subscriptionMinimumScorePolicy, _newSubscriptionMinimumScorePolicy
		);
		require(_newSchedulerRewardRatioPolicy <= 100);
		m_stakeRatioPolicy               = _newStakeRatioPolicy;
		m_schedulerRewardRatioPolicy     = _newSchedulerRewardRatioPolicy;
		m_subscriptionMinimumStakePolicy = _newSubscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _newSubscriptionMinimumScorePolicy;
	}

	/************************* worker list management **************************/
	function getWorkerAddress(uint _index) public view returns (address)
	{
		return m_workers[_index];
	}
	function getWorkerIndex(address _worker) public view returns (uint)
	{
		uint index = m_workerIndex[_worker];
		require(m_workers[index] == _worker);
		return index;
	}
	function getWorkersCount() public view returns (uint)
	{
		return m_workers.length;
	}

	function subscribeToPool() public returns (bool)
	{
		//msg.sender = worker
		require(iexecHubInterface.registerToPool(msg.sender));
		uint index = m_workers.push(msg.sender);
		m_workerIndex[msg.sender] = index.sub(1);
		emit WorkerSubscribe(msg.sender);
		return true;
	}

	function unsubscribeFromPool() public  returns (bool)
	{
		//msg.sender = worker
		require(iexecHubInterface.unregisterFromPool(msg.sender));
		require(removeWorker(msg.sender));
		emit WorkerUnsubscribe(msg.sender);
		return true;
	}

	function evictWorker(address _worker) public onlyOwner returns (bool)
	{
		//msg.sender = scheduler
		require(iexecHubInterface.evictWorker(_worker));
		require(removeWorker(_worker));
		emit WorkerEviction(_worker);
		return true;
	}

	function removeWorker(address _worker) internal returns (bool)
	{
		uint index = getWorkerIndex(_worker); // fails if worker not registered
		address lastWorker = m_workers[m_workers.length.sub(1)];
		m_workers    [index     ] = lastWorker;
		m_workerIndex[lastWorker] = index;
		delete m_workers[m_workers.length.sub(1)];
		m_workers.length=m_workers.length.sub(1);
		return true;
	}

	function getConsensusDetails(address _woid) public view returns (
		uint256 c_poolReward,
		uint256 c_stakeAmount,
		bytes32 c_consensus,
		uint256 c_revealDate,
		uint256 c_revealCounter,
		uint256 c_consensusTimout,
		uint256 c_winnerCount)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		return (
			consensus.poolReward,
			consensus.stakeAmount,
			consensus.consensus,
			consensus.revealDate,
			consensus.revealCounter,
			consensus.consensusTimout,
			consensus.winnerCount
		);
	}

	function getContributorsCount(address _woid) public view returns (uint256 contributorsCount)
	{
		return m_consensus[_woid].contributors.length;
	}

	function getContributor(address _woid, uint256 index) public view returns (address contributor)
	{
		return m_consensus[_woid].contributors[index];
	}

	function existingContribution(address _woid,address _worker) public view  returns (bool contributionExist){
		return m_contributions[_woid][_worker].status != IexecLib.ContributionStatusEnum.UNSET;
	}

	function getContribution(address _woid,address _worker) public view returns
	(
		IexecLib.ContributionStatusEnum status,
		bytes32 resultHash,
		bytes32 resultSign,
		address enclaveChallenge,
		uint256 score,
		uint256 weight)
	{
		require(existingContribution(_woid,_worker));//no silent value returned
		IexecLib.Contribution storage contribution = m_contributions[_woid][_worker];
		return (
			contribution.status,
			contribution.resultHash,
			contribution.resultSign,
			contribution.enclaveChallenge,
			contribution.score,
			contribution.weight
		);
	}


	/**************************** Works management *****************************/
	function emitWorkOrder(address _woid, uint256 _marketorderIdx) public onlyIexecHub returns (bool)
	{
		uint256 catid   = marketplaceInterface.getMarketOrderCategory(_marketorderIdx);
		uint256 timeout = iexecHubInterface.getCategoryWorkClockTimeRef(catid).mul(CONSENSUS_DURATION_RATIO).add(now);

		IexecLib.Consensus storage consensus = m_consensus[_woid];
		consensus.poolReward      = marketplaceInterface.getMarketOrderValue(_marketorderIdx);
		consensus.stakeAmount     = consensus.poolReward.percentage(m_stakeRatioPolicy);
		consensus.consensusTimout = timeout;

		emit WorkOrderActive(_woid);
		return true;
	}

	function claimFailedConsensus(address _woid) public onlyIexecHub returns (bool)
	{
	  IexecLib.Consensus storage consensus = m_consensus[_woid];
		require(now > consensus.consensusTimout);
		uint256 i;
		address w;
		for (i = 0; i < consensus.contributors.length; ++i)
		{
			w = consensus.contributors[i];
			if (m_contributions[_woid][w].status != IexecLib.ContributionStatusEnum.AUTHORIZED)
			{
 				require(iexecHubInterface.unlockForWork(_woid, w, consensus.stakeAmount));
			}
		}
		return true;
	}

	function allowWorkersToContribute(address _woid, address[] _workers, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		for (uint i = 0; i < _workers.length; ++i)
		{
			require(allowWorkerToContribute(_woid, _workers[i], _enclaveChallenge));
		}
		return true;
	}

	function allowWorkerToContribute(address _woid, address _worker, address _enclaveChallenge) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		require(WorkOrder(_woid).m_status() == IexecLib.WorkOrderStatusEnum.ACTIVE);
		IexecLib.Contribution storage contribution = m_contributions[_woid][_worker];
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		require(now <= consensus.consensusTimout);

		address workerPool;
		uint256 workerScore;
		(workerPool, workerScore) = iexecHubInterface.getWorkerStatus(_worker); // workerPool, workerScore
		require(workerPool == address(this));

		require(contribution.status == IexecLib.ContributionStatusEnum.UNSET);
		contribution.status           = IexecLib.ContributionStatusEnum.AUTHORIZED;
		contribution.enclaveChallenge = _enclaveChallenge;

		emit AllowWorkerToContribute(_woid, _worker, workerScore);
		return true;
	}

	function contribute(address _woid, bytes32 _resultHash, bytes32 _resultSign, uint8 _v, bytes32 _r, bytes32 _s) public returns (uint256 workerStake)
	{
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		require(now <= consensus.consensusTimout);
		IexecLib.Contribution storage contribution = m_contributions[_woid][msg.sender];

		// msg.sender = a worker
		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
			require(contribution.enclaveChallenge == ecrecover(keccak256("\x19Ethereum Signed Message:\n64", _resultHash, _resultSign), _v, _r, _s));
		}

		require(contribution.status == IexecLib.ContributionStatusEnum.AUTHORIZED);
		contribution.status     = IexecLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		contribution.score      = iexecHubInterface.getWorkerScore(msg.sender);
		consensus.contributors.push(msg.sender);

		require(iexecHubInterface.lockForWork(_woid, msg.sender, consensus.stakeAmount));
		emit Contribute(_woid, msg.sender, _resultHash);
		return consensus.stakeAmount;
	}

	function revealConsensus(address _woid, bytes32 _consensus) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
  	require(now <= consensus.consensusTimout);
		require(iexecHubInterface.startRevealingPhase(_woid));

		consensus.winnerCount = 0;
		for (uint256 i = 0; i<consensus.contributors.length; ++i)
		{
			address w = consensus.contributors[i];
			if (m_contributions[_woid][w].resultHash == _consensus)
			{
				consensus.winnerCount = consensus.winnerCount.add(1);
			}
		}
		require(consensus.winnerCount > 0); // you cannot revealConsensus if no worker has contributed to this hash

		consensus.consensus  = _consensus;
		consensus.revealDate = iexecHubInterface.getCategoryWorkClockTimeRef(marketplaceInterface.getMarketOrderCategory(WorkOrder(_woid).m_marketorderIdx())).mul(REVEAL_PERIOD_DURATION_RATIO).add(now); //is it better to store th catid ?
		emit RevealConsensus(_woid, _consensus);
		return true;
	}

	function reveal(address _woid, bytes32 _result) public returns (bool)
	{
		IexecLib.Consensus    storage consensus    = m_consensus[_woid];
		require(now <= consensus.consensusTimout);
		IexecLib.Contribution storage contribution = m_contributions[_woid][msg.sender];

		require(WorkOrder(_woid).m_status() == IexecLib.WorkOrderStatusEnum.REVEALING     );
		require(consensus.revealDate        >  now                                        );
		require(contribution.status         == IexecLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash     == consensus.consensus                        );
		require(contribution.resultHash     == keccak256(_result                        ) );
		require(contribution.resultSign     == keccak256(_result ^ keccak256(msg.sender)) );

		contribution.status     = IexecLib.ContributionStatusEnum.PROVED;
		consensus.revealCounter = consensus.revealCounter.add(1);

		emit Reveal(_woid, msg.sender, _result);
		return true;
	}

	function reopen(address _woid) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		require(now <= consensus.consensusTimout);
		require(consensus.revealDate <= now && consensus.revealCounter == 0);
		require(iexecHubInterface.reActivate(_woid));
		// Reset to status before revealConsensus
		consensus.winnerCount = 0;
		consensus.consensus   = 0x0;
		consensus.revealDate  = 0;

		for (uint256 i = 0; i < consensus.contributors.length; ++i)
		{
			address w = consensus.contributors[i];
			if (m_contributions[_woid][w].resultHash == consensus.consensus)
			{
				m_contributions[_woid][w].status = IexecLib.ContributionStatusEnum.REJECTED;
			}
		}
		return true;
	}

	// if sheduler never call finalized ? no incetive to do that. schedulermust be pay also at this time
	function finalizeWork(address _woid, string _stdout, string _stderr, string _uri) public onlyOwner /*onlySheduler*/ returns (bool)
	{
		IexecLib.Consensus storage consensus = m_consensus[_woid];
		require(now <= consensus.consensusTimout);
		require((consensus.revealDate <= now && consensus.revealCounter > 0) || (consensus.revealCounter == consensus.winnerCount)); //consensus.winnerCount never 0 at this step

		// add penalized to the call worker to contribution and they never contribute ?
		require(distributeRewards(_woid, consensus));

		require(iexecHubInterface.finalizeWorkOrder(_woid, _stdout, _stderr, _uri));
		return true;
	}

	function distributeRewards(address _woid, IexecLib.Consensus _consensus) internal returns (bool)
	{
		uint256 i;
		address w;
		/**
		 * Reward distribution:
		 * totalReward is to be distributed amoung the winners relative to their
		 * contribution. I believe that the weight should be someting like:
		 *
		 * w ~= 1+log(score*bonus)
		 *
		 * Is it worth the gaz necessay to compute the log?
		 * → https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity#8110
		 */
		uint256 workerBonus;
		uint256 workerWeight;
		uint256 totalWeight;
		uint256 workerReward;
		uint256 totalReward = _consensus.poolReward;
		address[] memory contributors = _consensus.contributors;
		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			IexecLib.Contribution storage c = m_contributions[_woid][w];
			if (c.status == IexecLib.ContributionStatusEnum.PROVED)
			{
				workerBonus  = (c.enclaveChallenge != address(0)) ? 3 : 1; // TODO: bonus sgx = 3 ?
				workerWeight = 1 + c.score.mul(workerBonus).log();
				totalWeight  = totalWeight.add(workerWeight);
				c.weight     = workerWeight; // store so we don't have to recompute
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(_consensus.stakeAmount);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(m_schedulerRewardRatioPolicy));

		for (i = 0; i<contributors.length; ++i)
		{
			w = contributors[i];
			if (m_contributions[_woid][w].status == IexecLib.ContributionStatusEnum.PROVED)
			{
				workerReward = workersReward.mulByFraction(m_contributions[_woid][w].weight, totalWeight);
				totalReward  = totalReward.sub(workerReward);
				require(iexecHubInterface.unlockForWork(_woid, w, _consensus.stakeAmount));
				require(iexecHubInterface.rewardForWork(_woid, w, workerReward, true));
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				require(iexecHubInterface.seizeForWork(_woid, w, _consensus.stakeAmount, true));
				// No Reward
			}
		}
		// totalReward now contains the scheduler share
		require(iexecHubInterface.rewardForWork(_woid, m_owner, totalReward, false));

		return true;
	}

}

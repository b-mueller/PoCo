pragma solidity ^0.4.21;

import "rlc-token/contracts/RLC.sol";

import './WorkOrder.sol';
import './Marketplace.sol';

import './AppHub.sol';
import './DatasetHub.sol';
import './WorkerPoolHub.sol';
import './WorkOrderFactory.sol';


import "./SafeMathOZ.sol";
import './IexecLib.sol';

/**
 * @title IexecHub
 */

contract IexecHub is OwnableOZ
{
	using SafeMathOZ for uint256;

	/**
	* RLC contract for token transfers.
	*/
	RLC public rlc;

	uint256 public constant STAKE_BONUS_RATIO         = 10;
	uint256 public constant STAKE_BONUS_MIN_THRESHOLD = 1000;
	uint256 public constant SCORE_UNITARY_SLASH       = 50;

	/**
	 * Slaves contracts
	 */
	AppHub           public appHub;
	DatasetHub       public datasetHub;
	WorkerPoolHub    public workerPoolHub;
	WorkOrderFactory public workOrderFactory;

	/**
	 * Market place
	 */
	Marketplace marketplace;
	modifier onlyMarketplace()
	{
		require(msg.sender == address(marketplace));
		_;
	}
	/**
	 * Categories
	 */
	mapping(uint256 => IexecLib.Category) public m_categories;
	uint256                               public m_categoriesCount;

	/**
	 * Escrow
	 */
	mapping(address => IexecLib.Account) public m_accounts;

	/**
	 * Reputation for PoCo
	 */
	mapping(address => uint256)  public m_scores;
	IexecLib.ContributionHistory public m_contributionHistory;

	/**
	 * Events
	 */
	event CreateApp       (address indexed appOwner,        address indexed app,        string appName,     uint256 appPrice,     string appParams    );
	event CreateDataset   (address indexed datasetOwner,    address indexed dataset,    string datasetName, uint256 datasetPrice, string datasetParams);
	event CreateWorkerPool(address indexed workerPoolOwner, address indexed workerPool, string workerPoolDescription                                  );
	event CreateCategory  (uint256 catid, string name, string description, uint256 workClockTimeRef);

	event WorkerPoolSubscription  (address indexed workerPool, address worker);
	event WorkerPoolUnsubscription(address indexed workerPool, address worker);
	event WorkerPoolEviction      (address indexed workerPool, address worker);

	event WorkOrderActivated(address indexed woid, address indexed workerPool);
	event WorkOrderClaimed  (address indexed woid, address indexed workerPool);
	event WorkOrderCompleted(address indexed woid, address indexed workerPool);

	event AccurateContribution(address woid, address indexed worker);
	event FaultyContribution  (address woid, address indexed worker);

	event Deposit (address owner, uint256 amount);
	event Withdraw(address owner, uint256 amount);
	event Reward  (address user,  uint256 amount);
	event Seize   (address user,  uint256 amount);

	/**
	 * Constructor
	 */
	function IexecHub()
	public
	{
	}

	function attachContracts(
		address _tokenAddress,
		address _marketplaceAddress,
		address _appHubAddress,
		address _datasetHubAddress,
		address _workerPoolHubAddress,
		address _workOrderFactoryAddress)
	public
	{
		require(address(rlc) == address(0));
		rlc              = RLC             (_tokenAddress           );
		marketplace      = Marketplace     (_marketplaceAddress     );
		appHub           = AppHub          (_appHubAddress          );
		datasetHub       = DatasetHub      (_datasetHubAddress      );
		workerPoolHub    = WorkerPoolHub   (_workerPoolHubAddress   );
		workOrderFactory = WorkOrderFactory(_workOrderFactoryAddress);
	}

	/**
	 * Factory
	 */

	function createCategory(
		string  _name,
		string  _description,
		uint256 _workClockTimeRef)
	public onlyOwner returns (uint256 catid)
	/* public returns (uint256 catid) */
	{
		m_categoriesCount                  = m_categoriesCount.add(1);

		IexecLib.Category storage category = m_categories[m_categoriesCount];
		category.name                      = _name;
		category.description               = _description;
		category.workClockTimeRef          = _workClockTimeRef;

		emit CreateCategory(m_categoriesCount, _name, _description, _workClockTimeRef);
		return m_categoriesCount;
	}

	function createWorkerPool(
		string  _description,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	external returns (address createdWorkerPool)
	{
		address newWorkerPool = workerPoolHub.createWorkerPool(
			_description,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		emit CreateWorkerPool(tx.origin, newWorkerPool, _description);
		return newWorkerPool;
	}

	function createApp(
		string  _appName,
		uint256 _appPrice,
		string  _appParams)
	external returns (address createdApp)
	{
		address newApp = appHub.createApp(
			_appName,
			_appPrice,
			_appParams
		);
		emit CreateApp(tx.origin, newApp, _appName, _appPrice, _appParams);
		return newApp;
	}

	function createDataset(
		string  _datasetName,
		uint256 _datasetPrice,
		string  _datasetParams)
	external returns (address createdDataset)
	{
		address newDataset = datasetHub.createDataset(
			_datasetName,
			_datasetPrice,
			_datasetParams
			);
		emit CreateDataset(tx.origin, newDataset, _datasetName, _datasetPrice, _datasetParams);
		return newDataset;
	}

	/**
	 * WorkOrder Emission
	 */

	function marketOrders(
		/********** Order settings **********/
		uint256[3] _commonOrder,
		/* uint256 _commonOrder_category, */
		/* uint256 _commonOrder_trust, */
		/* uint256 _commonOrder_value, */
		/********** Pool settings **********/
		uint256 _poolOrder_volume,
		address _poolOrder_workerpool,
		/********** User settings **********/
		address[5] _userOrder,
		/* address _userOrder_app, */
		/* address _userOrder_dataset, */
		/* address _userOrder_callback, */
		/* address _userOrder_beneficiary, */
		/* address _userOrder_requester, */
		string  _userOrder_params,
		/********** Signatures **********/
		uint256[2] _salt,
		uint8[2]   _v,
		bytes32[2] _r,
		bytes32[2] _s)
	external returns (address)
	{
		require(workerPoolHub.isWorkerPoolRegistered(_poolOrder_workerpool));

		require(marketplace.matchOrders(
			_commonOrder,
			_poolOrder_volume,
			_poolOrder_workerpool,
			_userOrder,
			_userOrder_params,
			_salt,
			_v,
			_r,
			_s));

		uint256 appPayment = lockAppPayment(
			_userOrder[4],         //requester,
			_poolOrder_workerpool, //workerpool,
			_userOrder[0],         //app,
			_userOrder[2]);        //dataset

		WorkOrder woid = workOrderFactory.createWorkOrder(
			_commonOrder,
			_poolOrder_workerpool,
			WorkerPool(_poolOrder_workerpool).m_owner(),
			_userOrder,
			_userOrder_params,
			appPayment
		);

		require(WorkerPool(_poolOrder_workerpool).initiateConsensus(woid));

		emit WorkOrderActivated(woid, _poolOrder_workerpool);
		return woid;
	}

	function lockAppPayment(
		address _requester,
		address _workerpool, // Address of a smartcontract
		address _app,        // Address of a smartcontract
		address _dataset)    // Address of a smartcontract
	internal returns (uint256)
	{
		// APP
		App app = App(_app);
		require(appHub.isAppRegistered (_app));
		// initialize usercost with dapp price
		uint256 appPayment = app.m_appPrice();

		// DATASET
		if (_dataset != address(0)) // address(0) → no dataset
		{
			Dataset dataset = Dataset(_dataset);
			require(datasetHub.isDatasetRegistred(_dataset));
			// add optional datasetPrice for userCost
			appPayment = appPayment.add(dataset.m_datasetPrice());
		}

		require(lock(_requester, appPayment)); // Lock funds for app + dataset payment

		return appPayment;
	}

	/**
	 * WorkOrder life cycle
	 */

	function claimFailedConsensus(address _woid) public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);
		require(workorder.m_requester() == msg.sender);

		WorkerPool workerpool = WorkerPool(workorder.m_workerpool());

		IexecLib.WorkOrderStatusEnum currentStatus = workorder.m_status();
		require(currentStatus == IexecLib.WorkOrderStatusEnum.ACTIVE || currentStatus == IexecLib.WorkOrderStatusEnum.REVEALING);
		// Unlock stakes for all workers
		require(workerpool.claimFailedConsensus(_woid));
		workorder.claim(); // revert on error

		uint256 value           = workorder.m_value();
		address workerpoolOwner = workorder.m_workerpoolOwner();
		uint256 workerpoolStake = value.percentage(marketplace.ASK_STAKE_RATIO());

		require(unlock (workorder.m_requester(), value.add(workorder.m_appPayment()))); // UNLOCK THE FUNDS FOR REINBURSEMENT
		require(seize  (workerpoolOwner,         workerpoolStake));
		// put workerpoolOwner stake seize into iexecHub address for bonus for scheduler on next well finalized Task
		require(reward (this,                    workerpoolStake));
		require(lock   (this,                    workerpoolStake));


		emit WorkOrderClaimed(_woid, workorder.m_workerpool());
		return true;
	}

	function finalizeWorkOrder(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public returns (bool)
	{
		WorkOrder workorder = WorkOrder(_woid);

		require(workorder.m_workerpool() == msg.sender);
		require(workorder.m_status()     == IexecLib.WorkOrderStatusEnum.REVEALING);

		// APP
		App     app      = App(workorder.m_app());
		uint256 appPrice = app.m_appPrice();
		if (appPrice > 0)
		{
			require(reward(app.m_owner(), appPrice));
		}

		// DATASET
		Dataset dataset = Dataset(workorder.m_dataset());
		if (dataset != address(0))
		{
			uint256 datasetPrice = dataset.m_datasetPrice();
			if (datasetPrice > 0)
			{
				require(reward(dataset.m_owner(), datasetPrice));
			}
		}

		// WORKERPOOL → rewarding done by the caller itself

		/**
		 * seize stacked funds from requester.
		 * reward = value: was locked at market making
		 * appPayment: was locked at when emiting the workorder
		 */
		uint256 value           = workorder.m_value(); // revert if not exist
		address workerpoolOwner = workorder.m_workerpoolOwner(); // revert if not exist
		uint256 workerpoolStake = value.percentage(marketplace.ASK_STAKE_RATIO());

		require(seize (workorder.m_requester(), value.add(workorder.m_appPayment()))); // seize funds for payment (market value + appPayment)
		require(unlock(workerpoolOwner,         workerpoolStake)); // unlock scheduler stake

		// write results
		workorder.setResult(_stdout, _stderr, _uri); // revert on error

		// Rien ne se perd, rien ne se crée, tout se transfere
		// distribute bonus to scheduler. jackpot bonus come from scheduler stake loose on IexecHub contract

		// value → kitty
		(,value) = checkBalance(this); // kitty is locked on `this` wallet
		if(value > 0)
		{
			// value → fraction of kitty
			value = value.min(value.percentage(STAKE_BONUS_RATIO).max(STAKE_BONUS_MIN_THRESHOLD));
			require(seize(this,             value));
			require(reward(workerpoolOwner, value));
		}

		emit WorkOrderCompleted(_woid, workorder.m_workerpool());
		return true;
	}

	/**
	 * Views
	 */

	function existCategory(uint256 _catid) public view  returns (bool categoryExist)
	{
		return _catid <= m_categoriesCount;
	}

	function getCategory(uint256 _catid) public view returns (string name, string  description, uint256 workClockTimeRef)
	{
		require(existCategory(_catid));
		return (
			m_categories[_catid].name,
			m_categories[_catid].description,
			m_categories[_catid].workClockTimeRef
		);
	}

	function getWorkerStatus(address _worker) public view returns (address workerPool, uint256 workerScore)
	{
		return (workerPoolHub.getWorkerAffectation(_worker), m_scores[_worker]);
	}

	function getWorkerScore(address _worker) public view returns (uint256 workerScore)
	{
		return m_scores[_worker];
	}

	/**
	 * Worker subscription
	 */
	function registerToPool(address _worker) public returns (bool subscribed)
	// msg.sender = workerPool
	{
		WorkerPool workerpool = WorkerPool(msg.sender);
		// Check credentials
		require(workerPoolHub.isWorkerPoolRegistered(msg.sender));
		// Lock worker deposit
		require(lock(_worker, workerpool.m_subscriptionLockStakePolicy()));
		// Check subscription policy
		require(m_accounts[_worker].stake >= workerpool.m_subscriptionMinimumStakePolicy());
		require(m_scores[_worker]         >= workerpool.m_subscriptionMinimumScorePolicy());
		// Update affectation
		require(workerPoolHub.registerWorkerAffectation(msg.sender, _worker));
		// Trigger event notice
		emit WorkerPoolSubscription(msg.sender, _worker);
		return true;
	}

	function unregisterFromPool(address _worker) public returns (bool unsubscribed)
	// msg.sender = workerPool
	{
		require(removeWorker(msg.sender, _worker));
		// Trigger event notice
		emit WorkerPoolUnsubscription(msg.sender, _worker);
		return true;
	}

	function evictWorker(address _worker) public returns (bool unsubscribed)
	// msg.sender = workerpool
	{
		require(removeWorker(msg.sender, _worker));
		// Trigger event notice
		emit WorkerPoolEviction(msg.sender, _worker);
		return true;
	}

	function removeWorker(address _workerpool, address _worker) internal returns (bool unsubscribed)
	{
		WorkerPool workerpool = WorkerPool(_workerpool);
		// Check credentials
		require(workerPoolHub.isWorkerPoolRegistered(_workerpool));
		// Unlick worker stake
		require(unlock(_worker, workerpool.m_subscriptionLockStakePolicy()));
		// Update affectation
		require(workerPoolHub.unregisterWorkerAffectation(_workerpool, _worker));
		return true;
	}

	/**
	 * Stake, reward and penalty functions
	 */
	/* Marketplace */
	function lockForOrder(address _user, uint256 _amount) public onlyMarketplace returns (bool)
	{
		require(lock(_user, _amount));
		return true;
	}
	function unlockForOrder(address _user, uint256 _amount) public  onlyMarketplace returns (bool)
	{
		require(unlock(_user, _amount));
		return true;
	}
	/* Work */
	function lockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(workOrderFactory.isValid(_woid));
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(lock(_user, _amount));
		return true;
	}
	function unlockForWork(address _woid, address _user, uint256 _amount) public returns (bool)
	{
		require(workOrderFactory.isValid(_woid));
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(unlock(_user, _amount));
		return true;
	}
	function rewardForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool)
	{
		require(workOrderFactory.isValid(_woid));
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(reward(_worker, _amount));
		// ------------------------------------------------------------------------
		if (_reputation)
		{
			m_contributionHistory.success = m_contributionHistory.success.add(1);
			m_scores[_worker] = m_scores[_worker].add(1);
			emit AccurateContribution(_woid, _worker);
		}
		return true;
	}
	function seizeForWork(address _woid, address _worker, uint256 _amount, bool _reputation) public returns (bool)
	{
		require(workOrderFactory.isValid(_woid));
		require(WorkOrder(_woid).m_workerpool() == msg.sender);
		require(seize(_worker, _amount));
		// ------------------------------------------------------------------------
		if (_reputation)
		{
			m_contributionHistory.failled = m_contributionHistory.failled.add(1);
			m_scores[_worker] = m_scores[_worker].sub(m_scores[_worker].min(SCORE_UNITARY_SLASH));
			emit FaultyContribution(_woid, _worker);
		}
		return true;
	}
	/**
	 * Wallet methods: public
	 */
	function deposit(uint256 _amount) external returns (bool)
	{
		require(rlc.transferFrom(msg.sender, address(this), _amount));
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.add(_amount);
		emit Deposit(msg.sender, _amount);
		return true;
	}
	function withdraw(uint256 _amount) external returns (bool)
	{
		m_accounts[msg.sender].stake = m_accounts[msg.sender].stake.sub(_amount);
		require(rlc.transfer(msg.sender, _amount));
		emit Withdraw(msg.sender, _amount);
		return true;
	}
	function checkBalance(address _owner) public view returns (uint256 stake, uint256 locked)
	{
		return (m_accounts[_owner].stake, m_accounts[_owner].locked);
	}
	/**
	 * Wallet methods: Internal
	 */
	function reward(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake = m_accounts[_user].stake.add(_amount);
		emit Reward(_user, _amount);
		return true;
	}
	function seize(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		emit Seize(_user, _amount);
		return true;
	}
	function lock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = m_accounts[_user].stake.sub(_amount);
		m_accounts[_user].locked = m_accounts[_user].locked.add(_amount);
		return true;
	}
	function unlock(address _user, uint256 _amount) internal returns (bool)
	{
		m_accounts[_user].locked = m_accounts[_user].locked.sub(_amount);
		m_accounts[_user].stake  = m_accounts[_user].stake.add(_amount);
		return true;
	}
}
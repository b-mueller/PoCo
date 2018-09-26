pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

library IexecODBLib
{
	/**
	* Tools
	*/
	struct Account
	{
		uint256 stake;
		uint256 locked;
	}
	struct Category
	{
		string  name;
		string  description;
		uint256 workClockTimeRef;
	}

	/**
	 * Generic
	 */
	struct signature
	{
		uint8   v;
		bytes32 r;
		bytes32 s;
	}

	/**
	 * Clerk - Orders
	 */
	struct EIP712Domain
	{
		string  name;
		string  version;
		uint256 chainId;
		address verifyingContract;
	}
	struct DappOrder
	{
		address dapp;
		uint256 dappprice;
		uint256 volume;
		address datarestrict;
		address poolrestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct DataOrder
	{
		address data;
		uint256 dataprice;
		uint256 volume;
		address dapprestrict;
		address poolrestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct PoolOrder
	{
		address pool;
		uint256 poolprice;
		uint256 volume;
		uint256 category;
		uint256 trust;
		uint256 tag;
		address dapprestrict;
		address datarestrict;
		address userrestrict;
		bytes32 salt;
		signature sign;
	}
	struct UserOrder
	{
		address dapp;
		uint256 dappmaxprice;
		address data;
		uint256 datamaxprice;
		address pool;
		uint256 poolmaxprice;
		address requester;
		uint256 volume;
		uint256 category;
		uint256 trust;
		uint256 tag;
		address beneficiary;
		address callback;
		string  params;
		bytes32 salt;
		signature sign;
	}

	/**
	 * Clerk - Deals
	 */
	struct Resource
	{
		address pointer;
		address owner;
		uint256 price;
	}
	struct Deal
	{
		// Ressources
		Resource dapp;
		Resource data;
		Resource pool;
		uint256  trust;
		uint256  tag;
		// execution details
		address requester;
		address beneficiary;
		address callback;
		string  params;
	}
	struct Config
	{
		// execution settings
		uint256 category;
		uint256 startTime;
		uint256 botFirst;
		uint256 botSize;
		// consistency
		uint256 workerStake;
		uint256 schedulerRewardRatio;
	}

	/**
	 * Tasks
	 // TODO: rename Workorder → Task
	 */
	enum TaskStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		COMPLETED, // Concensus achieved
		FAILLED    // Failled consensus
	}
	struct Task
	{
		TaskStatusEnum status;
		bytes32   dealid;
		uint256   idx;
		uint256   consensusDeadline;
		bytes32   consensusValue;
		/*
		// TODO: results for oracle?
		bytes     results;
		*/
		uint256   revealDeadline;
		uint256   revealCounter;
		uint256   winnerCounter;
		address[] contributors;
	}

	/**
	 * Consensus
	 */
	enum ContributionStatusEnum
	{
		UNSET,
		CONTRIBUTED,
		PROVED,
		REJECTED
	}
	struct Contribution
	{
		ContributionStatusEnum status;
		bytes32 resultHash;
		bytes32 resultSign;
		address enclaveChallenge;
		uint256 score;
		uint256 weight;
	}

}

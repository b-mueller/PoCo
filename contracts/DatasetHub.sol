pragma solidity ^0.4.18;

import "./Dataset.sol";
import "./OwnableOZ.sol";
import "./SafeMathOZ.sol";

contract DatasetHub is OwnableOZ // is Owned by IexecHub
{
	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256)                     m_datasetCountByOwner;
	mapping(address => mapping(uint256 => address)) m_datasetByOwnerByIndex;
	mapping(address => address)                     m_ownerByDataset;


	/**
	 * Constructor
	 */
	function DatasetHub() public
	{
	}

	/**
	 * Methods
	 */
	function getDatasetsCount(address _owner) public view returns (uint256)
	{
		return m_datasetCountByOwner[tx.origin];
	}

	function getDataset(address _owner, uint256 _index) public view returns (address)
	{
		return m_datasetByOwnerByIndex[_owner][_index];
	}

	function getDatasetOwner(address _dataset) public view returns (address)
	{
		return m_ownerByDataset[_dataset];
	}

	function isDatasetRegistred(address _dataset) public view returns (bool)
	{
		return m_ownerByDataset[_dataset] != 0x0;
	}

	function addDataset(address _owner, address _dataset) internal
	{
		uint id = m_datasetCountByOwner[_owner];
		m_datasetCountByOwner  [_owner]     = id.add(1);
		m_datasetByOwnerByIndex[_owner][id] = _dataset;
		m_ownerByDataset       [_dataset]   = _owner;
	}

	function createDataset(
		string _datasetName,
		uint256 _datasetPrice,
		string _datasetParams)
	public onlyOwner /*owner == IexecHub*/ returns (address createdDataset)
	{
		// tx.origin == owner
		// msg.sender == IexecHub
		address newDataset = new Dataset(
			msg.sender,
			_datasetName,
			_datasetPrice,
			_datasetParams
		);
		addDataset(tx.origin, newDataset);
		return newDataset;
	}

	function getDatasetPrice(address _dataset) public view returns (uint256 datasetPrice)
	{
		return Dataset(_dataset).m_datasetPrice();
	}
	function isOpen(address _dataset) public view returns (bool)
	{
		return Dataset(_dataset).isOpen();
	}
	function isAppAllowed(address _dataset, address _app) public returns (bool)
	{
		return Dataset(_dataset).isAppAllowed(_app);
	}
	function isRequesterAllowed(address _dataset, address _requester) public returns (bool)
	{
		return Dataset(_dataset).isRequesterAllowed(_requester);
	}
	function isWorkerPoolAllowed(address _dataset, address _workerPool) public returns (bool)
	{
		return Dataset(_dataset).isWorkerPoolAllowed(_workerPool);
	}


}
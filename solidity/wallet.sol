pragma solidity ^0.4.19;

import "./SafeMath.sol";

/*****************************************************************************
 * Contract wallet: ...                                                      *
 *****************************************************************************/
contract wallet is SafeMath
{
	/**
	 * Account structure
	 */
	struct Account
	{
		uint stake;
		uint locked;
	}
	/**
	 * Internal data: address to account mapping
	 */
	mapping(address => Account) m_accounts;
	/**
	 * Public functions
	 */
	function deposit() public payable
	{
		m_accounts[msg.sender].stake = safeAdd(m_accounts[msg.sender].stake, msg.value);
	}
	function withdraw(uint _amount) public returns (bool)
	{
		m_accounts[msg.sender].stake = safeSub(m_accounts[msg.sender].stake, _amount);
		msg.sender.transfer(_amount);
		return true;
	}
	function checkBalance() public view returns(uint)
	{
		return m_accounts[msg.sender].stake;
	}
	/**
	 * Internal function
	 */
	function lock  (address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = safeSub(m_accounts[_user].stake,  _amount);
		m_accounts[_user].locked = safeAdd(m_accounts[_user].locked, _amount);
		return true;
	}
	function unlock(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].locked = safeSub(m_accounts[_user].locked, _amount);
		m_accounts[_user].stake  = safeAdd(m_accounts[_user].stake,  _amount);
		return true;
	}
	function reward(address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].stake  = safeAdd(m_accounts[_user].stake,  _amount);
		return true;
	}
	function seize (address _user, uint _amount) internal returns (bool)
	{
		m_accounts[_user].locked = safeSub(m_accounts[_user].locked, _amount);
		return true;
	}
}
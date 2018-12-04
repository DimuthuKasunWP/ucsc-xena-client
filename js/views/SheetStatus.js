/**
 * UCSC Xena Client
 * http://xena.ucsc.edu
 *
 * Standard Xena spreadsheet status indicator. Displays label with state and,
 * additional actions to delete state.
 *
 */

'use strict';

// Core dependencies, components
var React = require('react');

// Styles
var classNames = require('classnames');
var compStyles = require('./SheetStatus.module.css');

class SheetStatus extends React.Component {

	showCancel = (sheetState) => {

		return (sheetState !== 'None');
	}

	render() {
		var {disabled, label, onClose, sheetState} = this.props;
		return (
			<div className={classNames(compStyles.status, {[compStyles.disabled]: disabled})}>
				<div className={compStyles.label}>{label}</div>
				<div className={compStyles.state}>{sheetState}</div>
				{this.showCancel(sheetState) ? <i className='material-icons' onClick={disabled ? null : onClose}>close</i> : null}
			</div>
		);
	}
}

module.exports = SheetStatus;

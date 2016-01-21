"use strict";

let accordions = [];


/**
 * Represents a column of collapsible content regions.
 */
class Accordion{

	/**
	 * Instantiate a new Accordion instance.
	 *
	 * @param {HTMLElement} el                 - Container wrapped around each immediate fold
	 * @param {Object}      options            - Optional hash of settings
	 * @param {String}      options.openClass  - CSS class controlling each fold's "open" state
	 * @param {String}      options.closeClass - CSS class used to mark a fold as closed
	 * @param {String}      options.edgeClass  - CSS class toggled based on whether the bottom-edge is visible
	 * @param {String}      options.snapClass  - CSS class for disabling transitions between window resizes
	 * @param {Boolean}     options.noAria     - Disable the addition and management of ARIA attributes
	 * @param {Boolean}     options.noKeys     - Disable keyboard navigation
	 * @constructor
	 */
	constructor(el, options){
		this.index = accordions.push(this) - 1;
		
		/** Parse options */
		options         = options || {};
		this.openClass  = options.openClass  || "open";
		this.closeClass = options.closeClass || "closed";
		this.edgeClass  = (undefined === options.edgeClass ? "edge-visible" : options.edgeClass);
		this.snapClass  = (undefined === options.snapClass ? "snap"         : options.snapClass);
		this.noAria     = !!options.noAria;
		this.noKeys     = !!options.noKeys;
		
		
		/** Create a fold for each immediate descendant of the Accordion's container */
		let folds = [];
		for(let i of Array.from(el.children)){
			let fold = new Fold(this, i);
			folds.push(fold);
			
			/** Connect the fold to its previous sibling, if it's not the first to be added */
			let prev = folds[folds.length - 2];
			if(prev){
				prev.nextFold     = fold;
				fold.previousFold = prev;
			}
		}
		
		
		el.accordion    = this.index;
		this.noAria || el.setAttribute("role", "tablist");
		this.el         = el;
		this.folds      = folds;
		this.update();
		
		
		/** Find out if this accordion's nested inside another */
		let next = el;
		while((next = next.parentNode) && 1 === next.nodeType){
			let fold = Accordion.getFold(next);
			if(fold){
				let accordion   = fold.accordion;
				this.parent     = accordion;
				this.parentFold = fold;
				this.edgeClass && el.classList.remove(this.edgeClass);
				(accordion.childAccordions = accordion.childAccordions || []).push(this);
				(fold.childAccordions      = fold.childAccordions      || []).push(this);

				/** Adjust the height of the containing fold's element */
				if(fold.open){
					let scrollHeight = fold.el.scrollHeight;
					let distance     = (fold.heading.scrollHeight + fold.content.scrollHeight) - scrollHeight || (scrollHeight - fold.el.clientHeight);
					accordion.updateFold(fold, distance);
				}
				break;
			}
		}
		
		
		this.edgeClass && this.el.addEventListener(transitionEnd, e => {
			if(!this.parent && e.target === el && "height" === e.propertyName && el.getBoundingClientRect().bottom > window.innerHeight)
				el.classList.remove(this.edgeClass);
		});
	}
	

	
	/**
	 * Height of the accordion's container element.
	 *
	 * @property
	 * @type {Number}
	 */
	get height(){ return this._height; }
	set height(input){
		if(input && (input = +input) !== this._height){
			this.el.style.height = input + "px";
			this._height         = input;
		}
	}
	
	
	
	/**
	 * Internal method to check if an accordion's bottom-edge is visible to the user (or about to be).
	 *
	 * @param {Number} offset
	 * @private
	 */
	edgeCheck(offset){
		let edgeClass = this.edgeClass;
		if(edgeClass){
			let box         = this.el.getBoundingClientRect();
			let windowEdge  = window.innerHeight;
			let classes     = this.el.classList;
			
			/** If the bottom-edge is visible (or about to be), enable height animation */
			if(box.bottom + (offset || 0) < windowEdge)
				classes.add(edgeClass)
			
			/** If the bottom-edge isn't visible anyway, disable height animation immediately */
			else if(box.bottom > windowEdge)
				classes.remove(edgeClass);
		}
	}
	
	
	
	/**
	 * Update the vertical ordinate of each sibling for a particular fold.
	 *
	 * @param {Fold} fold
	 * @param {Number} offset - Pixel distance to adjust by
	 */
	updateFold(fold, offset){
		let next = fold;
		let parentFold = this.parentFold;
		
		while(next = next.nextFold)
			next.y  += offset;
		parentFold || this.edgeCheck(offset);
		fold.height += offset;
		this.height += offset;
		
		parentFold && parentFold.open && this.parent.updateFold(parentFold, offset);
	}
	
	
	/**
	 * Update the height of each fold to fit its content.
	 */
	update(){
		let y = 0;
		let height = 0;
		for(let i of this.folds){
			i.y = y;
			i.fit();
			y      += i.height;
			height += i.height;
		}
		
		let parentFold = this.parentFold;
		let diff       = height - this._height;
		parentFold
			? (parentFold.open && this.parent.updateFold(parentFold, diff))
			: this.edgeCheck(diff);
		
		this.height = height;
	}
	
	
	
	/**
	 * Recalculate the boundaries of an Accordion and its descendants.
	 *
	 * This method should only be called if the width of a container changes,
	 * or a fold's contents have resized unexpectedly (such as when images load).
	 *
	 * @param {Boolean} allowSnap - Snap folds instantly into place without transitioning
	 */
	refresh(allowSnap){
		let snap = allowSnap ? this.snapClass : false;
		snap && this.el.classList.add(snap);
		
		this.update();
		if(this.childAccordions)
			this.childAccordions.forEach(a => a.parentFold.open ? a.refresh(allowSnap) : (a.parentFold.needsRefresh = true))
		
		snap && setTimeout(e => this.el.classList.remove(snap), 20);
	}
	
	
	
	/**
	 * Whether one of the Accordion's folds has been resized incorrectly.
	 *
	 * @type {Boolean}
	 * @readonly
	 * @property
	 */
	get wrongSize(){
		for(let i of this.folds)
			if(i.wrongSize) return true;
		if(this.childAccordions) for(let i of this.childAccordions)
			if(i.wrongSize) return true;
		return false;
	}
	
	
	
	/**
	 * Return the top-level ancestor this accordion's nested inside.
	 *
	 * @type {Accordion}
	 * @readonly
	 * @property
	 */
	get root(){
		let result = this;
		while(result){
			if(!result.parent) return result;
			result = result.parent;
		}
	}
	
	
	
	/**
	 * Alter the rate at which screen-resize events update accordion widths.
	 *
	 * @param {Number} delay - Rate expressed in milliseconds
	 */
	static setResizeRate(delay){
		let fn = function(e){
			for(let i of accordions)
				i.parent || i.refresh(true);
		};
		
		window.removeEventListener("resize", this.onResize);
		
		/** Make sure we weren't passed an explicit value of FALSE, or a negative value */
		if(false !== delay && (delay = +delay || 0) >= 0){
			this.onResize = delay ? debounce(fn, delay) : fn;
			window.addEventListener("resize", this.onResize);
		}
	}
	
	
	
	/**
	 * Return the closest (most deeply-nested) accordion enclosing an element.
	 *
	 * @param {Node} node
	 * @return {Accordion}
	 */
	static getAccordion(node){
		while(node){
			if("accordion" in node)
				return accordions[node.accordion];
			
			node = node.parentNode;
			if(!node || node.nodeType !== 1) return null;
		}
	}
	
	
	/**
	 * Return the closest (most deeply-nested) fold enclosing an element.
	 *
	 * @param {Node} node
	 * @return {Fold}
	 */
	static getFold(node){
		while(node){
			if("accordionFold" in node)
				return folds[node.accordionFold];
			
			node = node.parentNode;
			if(!node || node.nodeType !== 1) return null;
		}
	}
}


Accordion.setResizeRate(25);
"use strict";


/**
 * Represents a column of collapsible content regions.
 */
class Accordion{

	/**
	 * Instantiate a new Accordion instance.
	 *
	 * @param {HTMLElement} el - Container wrapped around each immediate fold
	 * @constructor
	 */
	constructor(el){
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
		
		el.accordion = this;
		this.el      = el;
		this.folds   = folds;
		
		/** Find out if this accordion's nested inside another */
		let next = el;
		while((next = next.parentNode) && 1 === next.nodeType){
			let fold = next.accordionFold;
			if(fold){
				let accordion   = fold.accordion;
				this.parent     = accordion;
				this.parentFold = fold;
				(accordion.children = accordion.children || []).push(this);
				while(accordion){
					accordion.update();
					accordion = accordion.parent;
				}
				break;
			}
		}
		
		this.update();
		
		/** Temporary shit to remove later */
		window.addEventListener("resize", e => {
			this.update();
		})
	}
	
	get height(){
		return this._height;
	}
	set height(input){
		if(input && (input = +input) !== this._height){
			this.el.style.height = input + "px";
			this._height         = input;
		}
	}
	
	
	edgeCheck(offset){
		let box        = this.el.getBoundingClientRect();
		let isVisible  = box.bottom + (offset || 0) < window.innerHeight;
		this.el.classList.toggle("edge-visible", isVisible);
	}
	
	
	updateFold(fold, offset){
		let next = fold;
		while(next = next.nextFold)
			next.y  += offset;
		fold.height += offset;
		this.height += offset;
		
		let parentFold = this.parentFold;
		parentFold
			? this.parent.updateFold(parentFold, offset)
			: this.edgeCheck();
	}
	
	
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
			? this.parent.updateFold(parentFold, diff)
			: this.edgeCheck(diff);
		
		this.height = height;
	}
}

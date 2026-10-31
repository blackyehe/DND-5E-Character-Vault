/** A bounded tree has no references/cycles; IDs survive renames and reordering. */
export interface ChoiceNode {id:string;name:string;description:string;benefits:unknown[];group?:ChoiceGroup}
export interface ChoiceGroup {version:1;choose:number;options:ChoiceNode[]}
export function newChoiceGroup():ChoiceGroup{return {version:1,choose:1,options:[]}}
export function newChoiceNode():ChoiceNode{return {id:crypto.randomUUID(),name:'',description:'',benefits:[]}}
export function choiceGroupProblem(value:unknown,complete=true):string|undefined{
 const ids=new Set<string>(),objects=new Set<object>();let count=0
 function visit(value:unknown,depth:number):string|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value)||objects.has(value)||depth>4)return 'Choice groups must be a tree no deeper than four groups.'
  objects.add(value);const group=value as ChoiceGroup
  if(Object.keys(group).some(k=>!['version','choose','options'].includes(k))||group.version!==1||!Number.isInteger(group.choose)||group.choose<1||group.choose>100||!Array.isArray(group.options)||group.options.length>100)return 'Check the choice count and options.'
  if(complete&&group.choose>group.options.length)return 'The choice count cannot exceed the number of offered options.'
  for(const node of group.options){
   if(!node||typeof node!=='object'||Array.isArray(node)||objects.has(node)||++count>100)return 'A choice tree can contain at most 100 distinct options.'
   objects.add(node)
   if(Object.keys(node).some(k=>!['id','name','description','benefits','group'].includes(k))||typeof node.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(node.id)||ids.has(node.id))return 'Every choice needs a distinct stable ID.'
   ids.add(node.id)
   if(typeof node.name!=='string'||node.name.length>200||complete&&!node.name.trim()||typeof node.description!=='string'||node.description.length>100000||!Array.isArray(node.benefits)||node.benefits.length>200)return 'Check each choice name, description and Benefits.'
   if(node.group){const problem=visit(node.group,depth+1);if(problem)return problem}
  }
 }
 return visit(value,1)
}
export function choiceNodes(group:ChoiceGroup):ChoiceNode[]{return group.options.flatMap(n=>[n,...(n.group?choiceNodes(n.group):[])])}
/** Validate every reached group, and reject duplicate, removed or orphan IDs. */
export function choiceSelectionProblem(group:ChoiceGroup,ids:unknown):string|undefined{
 const problem=choiceGroupProblem(group);if(problem)return problem
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||ids.length>100||new Set(ids).size!==ids.length)return 'Choose distinct available options.'
 const selected=new Set(ids),visited=new Set<string>()
 function visit(g:ChoiceGroup):string|undefined{
  const nodes=g.options.filter(n=>selected.has(n.id));if(nodes.length!==g.choose)return `Choose exactly ${g.choose} option${g.choose===1?'':'s'} in each active group.`
  for(const node of nodes){visited.add(node.id);if(node.group){const issue=visit(node.group);if(issue)return issue}}
 }
 const issue=visit(group);if(issue)return issue
 if(visited.size!==selected.size)return 'A selected option was removed or belongs to an unselected branch. Choose the available options again.'
}
export function choiceBenefits(group:ChoiceGroup,ids:string[]):unknown[]{return choiceSelectionProblem(group,ids)?[]:choiceNodes(group).filter(n=>ids.includes(n.id)).flatMap(n=>n.benefits)}
export function choiceDescription(group:ChoiceGroup,ids:string[]):string{if(choiceGroupProblem(group))return '';return choiceNodes(group).filter(n=>ids.includes(n.id)).map(n=>`${n.name}${n.description?' — '+n.description:''}`).join('\n')}

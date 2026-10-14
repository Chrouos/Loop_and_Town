import { finalCorrection, finalInvestigationReady, offeredFinalSteps, type FinalStep } from '../finalGameplay';
import type { PlayerSave } from '../model';
import type { WorldState } from '../../simulator/types';

const captions: Record<FinalStep,string> = {
  trace_mismatch:'向在場的人說明兩份互相衝突的紀錄',
  invite_yuan:'詢問予安是否願意協助檢查',
  invite_doctor:'請柏勳在醫院確認安全影響',
  invite_detective:'請志遠帶著他保全的獨立紀錄加入',
  close_primary:'隔離最早發現的寫入接口',
  close_recovery:'沿另一條維修通道解除備援的改寫權限',
  fence_epoch:'阻止舊授權再被拿來執行',
  verify_isolation:'比對志遠的另一份紀錄，確認兩條線都失效',
  seal_once:'只封存這一次，接受今天的所有結果',
  seal_permanent:'保留預測，讓鎮上的系統再也不能自行改寫現實',
};

export function FinalInvestigationScene({save,world,minute,onStep}:{
  save:PlayerSave;world:WorldState;minute:number;onStep:(step:FinalStep)=>void;
}) {
  if(!finalInvestigationReady(save,world,minute)||minute<1111||minute>=1439) return null;
  const session=finalCorrection(save,minute);
  const offered=offeredFinalSteps(save,world,minute);
  const decisions=save.loops[save.currentLoopId].finalSteps;
  return <section className="final-investigation" aria-label="舊站的選擇" data-final-phase={session.phase}>
    <header className="final-investigation__header">
      <span>舊站控制室的紀錄</span>
      <time>{String(Math.floor(minute/60)%24).padStart(2,'0')}:{String(minute%60).padStart(2,'0')}</time>
    </header>
    {decisions.length===0 ? <p>時間還在向前。從螢幕與銘牌看見的並不是完整答案，但予安確實找到了第二條回路。</p>
      : <p>機械聲逐漸變得稀疏。每一次行動都留下痕跡，任何人也不必因為你看過其他今天，就失去自行決定的權利。</p>}
    {session.sealMode!=='NONE' ? <p role="status">你已經為今晚做出不可逆的結案決定。接下來，時間仍會走向午夜。</p>
    : <>
      {offered.map(step=><button key={step} type="button" onClick={()=>onStep(step)}>{captions[step]}</button>)}
      {!offered.length && <p>沒有可以立刻完成的操作。你可以繼續觀察；午夜不會等待你。</p>}
      <small>所有操作都會消耗世界時間。只切斷一條線，並不能證明世界安全。</small>
    </>}
  </section>;
}

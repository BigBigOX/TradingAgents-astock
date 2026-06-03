"use client";
import { useState, useEffect } from 'react';

interface Props { params: { ticker: string }; searchParams: { date?: string }; }

export default function Page({ params, searchParams }: Props) {
  const ticker = decodeURIComponent(params.ticker);
  const date = searchParams.date || new Date().toISOString().slice(0,10);
  const [signal,setSignal] = useState("");
  const [error,setError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,date})});
        if(!r.ok){const e=await r.json().catch(()=>({error:'Failed'}));throw new Error(e.error)}
        const reader=r.body?.getReader();if(!reader)throw new Error("No stream");
        const dec=new TextDecoder();let buf='';
        while(true){
          const{done,value}=await reader.read();if(done)break;
          buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||'';
          for(const line of lines){if(!line.startsWith('data: '))continue;
            const d=JSON.parse(line.slice(6));if(cancel)return;
            if(d.type==="complete")setSignal(d.signal);
            else if(d.type==="error")setError(d.message);
          }
        }
      }catch(e){if(!cancel)setError((e as Error).message)}
    })();
    return()=>{cancel=true};
  },[ticker,date]);

  return(
    <div className="p-6">
      <h1 className="text-xl font-bold">{ticker} 分析报告</h1>
      <p className="text-sm text-gray-400">日期: {date}</p>
      {error&&<div className="p-3 bg-red-900/30 rounded text-red-400 mt-4">{error}</div>}
      {signal&&<div className="p-4 bg-green-900/20 rounded mt-4"><span className="text-2xl font-bold">{signal}</span></div>}
    </div>
  );
}
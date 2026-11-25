import React, { useState } from 'react';
import { Download, FileText, Printer, RotateCcw } from 'lucide-react';
import './document-studio.css';

const initial = {
  college: 'COLLEGE OF BUSINESS AND EDUCATION',
  department: 'DEPARTMENT OF ACCOUNTING AND FINANCE.',
  programme: 'BACHELOR OF COMMERCE IN FINANCE',
  course: '',
  instructor: '',
  code: '',
  nature: 'INDIVIDUAL ASSIGNMENT',
  name: '',
  registration: '',
  courseShort: 'BCOM FIN',
  gender: '',
  signature: ''
};

export default function DocumentStudio() {
  const [details, setDetails] = useState(initial);
  const [title, setTitle] = useState('ASSIGNMENT TITLE');
  const [body, setBody] = useState('Type your assignment here.\\n\\nUse the simple formatting controls above to organise your work. Your text will appear on the A4 page preview.');
  const [format, setFormat] = useState('normal');

  const update = (key, value) => setDetails(current => ({ ...current, [key]: value }));
  const reset = () => { setDetails(initial); setTitle('ASSIGNMENT TITLE'); setBody('Type your assignment here.\\n\\nUse the simple formatting controls above to organise your work. Your text will appear on the A4 page preview.'); };

  function applyFormat(command, value) {
    document.execCommand(command, false, value || null);
  }

  return (
    <section className="document-studio section-wrap" id="document-studio">
      <div className="document-studio-heading">
        <div>
          <div className="eyebrow">STUDENT DOCUMENT WORKSPACE</div>
          <h2>Create your assignment. <em>Print it perfectly.</em></h2>
          <p>Complete the fixed UDOM cover page, write your work and preview it on A4 paper.</p>
        </div>
        <div className="document-actions">
          <button className="button button-light" onClick={reset}><RotateCcw size={16}/> Reset</button>
          <button className="button button-primary" onClick={() => window.print()}><Download size={16}/> Print / Save PDF</button>
        </div>
      </div>

      <div className="document-workspace">
        <aside className="document-controls">
          <h3><FileText size={17}/> Cover page details</h3>
          <p className="document-help">The cover layout is fixed. Only these information fields can be changed.</p>
          {[
            ['course','Course name'],['instructor','Course instructor'],['code','Course code'],
            ['name','Student full name'],['registration','Registration number'],['gender','Gender'],['signature','Signature / initials']
          ].map(([key,label]) => <label className="document-field" key={key}>{label}<input value={details[key]} onChange={e => update(key,e.target.value)} placeholder={label}/></label>)}
          <label className="document-field">Nature of work<select value={details.nature} onChange={e => update('nature',e.target.value)}><option>INDIVIDUAL ASSIGNMENT</option><option>GROUP ASSIGNMENT</option><option>FIELD REPORT</option><option>RESEARCH REPORT</option><option>COURSEWORK</option></select></label>
          <label className="document-field">Course / programme short name<input value={details.courseShort} onChange={e => update('courseShort',e.target.value)}/></label>
          <div className="document-tip">Your details update on the cover preview immediately. Institution branding and page layout remain fixed.</div>
        </aside>

        <div className="document-preview-area">
          <div className="preview-toolbar">
            <span>A4 DOCUMENT PREVIEW</span>
            <div>
              <button onClick={() => applyFormat('bold')} title="Bold"><b>B</b></button>
              <button onClick={() => applyFormat('italic')} title="Italic"><i>I</i></button>
              <button onClick={() => applyFormat('underline')} title="Underline"><u>U</u></button>
              <button onClick={() => applyFormat('insertUnorderedList')} title="Bulleted list">• List</button>
              <button onClick={() => applyFormat('formatBlock','H2')} title="Heading">Heading</button>
            </div>
          </div>
          <div className="a4-page cover-page">
            <div className="cover-inner">
              <h3>THE UNIVERSITY OF DODOMA</h3>
              <div className="udom-emblem"><span>THE UNIVERSITY OF DODOMA</span><b>UDOM</b><small>Embracing Knowledge</small></div>
              <h4>{details.college}</h4>
              <h4>{details.department}</h4>
              <p><strong>PROGRAMME NAME:</strong> {details.programme}.</p>
              <p><strong>COURSE NAME:</strong> {details.course || '________________________________'}</p>
              <p><strong>COURSE INSTRUCTOR:</strong> {details.instructor || '________________________________'}</p>
              <p><strong>COURSE CODE:</strong> {details.code || '____________'}</p>
              <p><strong>NATURE OF WORK:</strong> {details.nature}</p>
              <table className="cover-student-table">
                <thead><tr><th>NO</th><th>NAME</th><th>REGISTRATION NO</th><th>COURSE</th><th>G</th><th>SIGN</th></tr></thead>
                <tbody><tr><td>1</td><td>{details.name || ' '}</td><td>{details.registration || ' '}</td><td>{details.courseShort}</td><td>{details.gender}</td><td>{details.signature}</td></tr></tbody>
              </table>
            </div>
          </div>
          <div className="page-label">PAGE 1 · FIXED COVER TEMPLATE</div>
          <div className="a4-page body-page">
            <div className="body-document">
              <input className="document-title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Document title"/>
              <div className="document-editor" contentEditable suppressContentEditableWarning onInput={e => setBody(e.currentTarget.innerText)}>{body}</div>
            </div>
          </div>
          <div className="page-label">PAGE 2 · EDITABLE DOCUMENT BODY</div>
        </div>
      </div>
    </section>
  );
}

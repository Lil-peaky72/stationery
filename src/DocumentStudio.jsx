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
  const [groupStudents, setGroupStudents] = useState([{ name: '', registration: '', course: 'BCOM FIN', gender: '', signature: '' }, { name: '', registration: '', course: 'BCOM FIN', gender: '', signature: '' }]);
  const [title, setTitle] = useState('ASSIGNMENT TITLE');
  const [body, setBody] = useState('Type your assignment here.\\n\\nUse the simple formatting controls above to organise your work. Your text will appear on the A4 page preview.');
  const [format, setFormat] = useState('normal');

  const update = (key, value) => setDetails(current => ({ ...current, [key]: value }));
  const updateStudent = (index, key, value) => setGroupStudents(current => current.map((student, i) => i === index ? { ...student, [key]: value } : student));
  const changeNature = value => { update('nature', value); if (value === 'GROUP ASSIGNMENT' && groupStudents.length < 2) setGroupStudents([{ name: '', registration: '', course: details.courseShort, gender: '', signature: '' }, { name: '', registration: '', course: details.courseShort, gender: '', signature: '' }]); };
  const changeStudentCount = value => { const count = Math.max(2, Math.min(50, Number(value) || 2)); setGroupStudents(current => Array.from({ length: count }, (_, i) => current[i] || { name: '', registration: '', course: details.courseShort, gender: '', signature: '' })); };
  const reset = () => { setDetails(initial); setGroupStudents([{ name: '', registration: '', course: 'BCOM FIN', gender: '', signature: '' }, { name: '', registration: '', course: 'BCOM FIN', gender: '', signature: '' }]); setTitle('ASSIGNMENT TITLE'); setBody('Type your assignment here.\\n\\nUse the simple formatting controls above to organise your work. Your text will appear on the A4 page preview.'); };

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
            ['programme','Programme name'],['course','Course name'],['instructor','Course instructor'],['code','Course code']
          ].map(([key,label]) => <label className="document-field" key={key}>{label}<input value={details[key]} onChange={e => update(key,e.target.value)} placeholder={label}/></label>)}
          <label className="document-field">Nature of work<select value={details.nature} onChange={e => changeNature(e.target.value)}><option>INDIVIDUAL ASSIGNMENT</option><option>GROUP ASSIGNMENT</option><option>FIELD REPORT</option><option>RESEARCH REPORT</option><option>COURSEWORK</option></select></label>
          {details.nature === 'GROUP ASSIGNMENT' ? <>
            <label className="document-field">Number of group members<input type="number" min="2" max="50" value={groupStudents.length} onChange={e => changeStudentCount(e.target.value)}/></label>
            <p className="document-help">Increase the number to add more students. Each member gets a row on the cover page.</p>
            {groupStudents.map((student,index) => <div className="group-student-editor" key={index}>
              <strong>Student {index + 1}</strong>
              { [['name','Full name'],['registration','Registration number'],['course','Course short name'],['gender','Gender'],['signature','Signature / initials']].map(([key,label]) => <label className="document-field" key={key}>{label}<input value={student[key]} onChange={e => updateStudent(index,key,e.target.value)} placeholder={label}/></label>)}
            </div>)}
          </> : <>
            { [['name','Student full name'],['registration','Registration number'],['gender','Gender'],['signature','Signature / initials']].map(([key,label]) => <label className="document-field" key={key}>{label}<input value={details[key]} onChange={e => update(key,e.target.value)} placeholder={label}/></label>)}
            <label className="document-field">Course / programme short name<input value={details.courseShort} onChange={e => update('courseShort',e.target.value)}/></label>
          </>}
          <div className="document-tip">Your details update on the cover preview immediately. The programme name and student details are editable. The official UDOM emblem is included in the printed cover page.</div>
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
              <img className="udom-cover-logo" src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="Official University of Dodoma emblem" />
              <h4>{details.college}</h4>
              <h4>{details.department}</h4>
              <p><strong>PROGRAMME NAME:</strong> {details.programme}.</p>
              <p><strong>COURSE NAME:</strong> {details.course || '________________________________'}</p>
              <p><strong>COURSE INSTRUCTOR:</strong> {details.instructor || '________________________________'}</p>
              <p><strong>COURSE CODE:</strong> {details.code || '____________'}</p>
              <p><strong>NATURE OF WORK:</strong> {details.nature}</p>
              <table className="cover-student-table">
                <thead><tr><th>NO</th><th>NAME</th><th>REGISTRATION NO</th><th>COURSE</th><th>G</th><th>SIGN</th></tr></thead>
                <tbody>{(details.nature === 'GROUP ASSIGNMENT' ? groupStudents : [{ name: details.name, registration: details.registration, course: details.courseShort, gender: details.gender, signature: details.signature }]).map((student,index) => <tr key={index}><td>{index + 1}</td><td>{student.name || ' '}</td><td>{student.registration || ' '}</td><td>{student.course || ' '}</td><td>{student.gender || ' '}</td><td>{student.signature || ' '}</td></tr>)}</tbody>
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

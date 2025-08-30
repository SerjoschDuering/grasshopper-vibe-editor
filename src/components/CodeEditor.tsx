'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-gray-500">
        <i className="fas fa-spinner fa-spin mr-2"></i>
        Loading editor...
      </div>
    </div>
  ),
})

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
  className?: string
}

export default function CodeEditor({ 
  value, 
  onChange, 
  height = '50vh',
  className = ''
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const [isExternalUpdate, setIsExternalUpdate] = useState(false)

  // Handle editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Configure Python language defaults
    monaco.languages.setLanguageConfiguration('python', {
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string'] },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      folding: {
        offSide: true
      },
      indentationRules: {
        increaseIndentPattern: /^((?!def|if|elif|else|for|while|class|try|except|finally|with).*)?:\s*$/,
        decreaseIndentPattern: /^\s*(elif|else|except|finally)\s*:/
      }
    })

    // Set up completion provider for Python
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        // Basic Python completions for Grasshopper/Rhino environment
        const suggestions = [
          {
            label: 'import rhinoscriptsyntax as rs',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'import rhinoscriptsyntax as rs',
            documentation: 'Import rhinoscriptsyntax module',
            range
          },
          {
            label: 'import Rhino',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'import Rhino',
            documentation: 'Import Rhino module',
            range
          },
          {
            label: 'import Grasshopper as gh',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'import Grasshopper as gh',
            documentation: 'Import Grasshopper module',
            range
          },
          {
            label: 'print',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'print("${1:message}")',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Print to console (Python 2.7 style)',
            range
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'for ${1:item} in ${2:items}:\n    ${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'For loop',
            range
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'if ${1:condition}:\n    ${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'If statement',
            range
          },
          {
            label: 'def',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'def ${1:function_name}(${2:params}):\n    """${3:docstring}"""\n    ${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Function definition',
            range
          }
        ]

        return { suggestions }
      }
    })
  }

  // Handle external value updates without losing cursor position
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      const position = editorRef.current.getPosition()
      const selection = editorRef.current.getSelection()
      
      setIsExternalUpdate(true)
      editorRef.current.setValue(value)
      
      // Restore cursor position and selection
      if (position) {
        editorRef.current.setPosition(position)
      }
      if (selection) {
        editorRef.current.setSelection(selection)
      }
      
      setIsExternalUpdate(false)
    }
  }, [value])

  const handleChange = (newValue: string | undefined) => {
    if (!isExternalUpdate && newValue !== undefined) {
      onChange(newValue)
    }
  }

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    // Mirror Ace editor options
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
    theme: 'vs-light', // Similar to ace/theme/tomorrow
    language: 'python',
    
    // Editor behavior
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
    
    // Auto-completion and snippets (mirroring Ace config)
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    snippetSuggestions: 'inline',
    
    // UI options
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    automaticLayout: true,
    
    // Guides
    guides: {
      indentation: true,
      bracketPairs: true
    },
    
    // Additional features
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
    renderWhitespace: 'selection',
    
    // Cursor
    cursorStyle: 'line',
    cursorBlinking: 'blink',
    
    // Scrollbar
    scrollbar: {
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  }

  return (
    <div 
      className={`border-0 rounded-md overflow-hidden ${className}`}
      style={{ height, minHeight: '300px' }}
    >
      <MonacoEditor
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={editorOptions}
        defaultLanguage="python"
        loading={
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-gray-500">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Loading editor...
            </div>
          </div>
        }
      />
    </div>
  )
}
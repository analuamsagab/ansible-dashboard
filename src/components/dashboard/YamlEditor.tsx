import { useState, useRef, useEffect } from 'react'
import { Upload } from 'lucide-react'

interface YamlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function YamlEditor({ value, onChange, placeholder, minHeight = '200px' }: YamlEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lineCount, setLineCount] = useState(1)

  useEffect(() => {
    setLineCount(value.split('\n').length)
  }, [value])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) file.text().then(onChange)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="relative border border-gray-700 rounded-lg overflow-hidden bg-gray-900/50">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 border-b border-gray-700">
        <span className="text-xs text-gray-500">YAML</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Upload className="w-3 h-3" />
          Upload
        </button>
        <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={handleFileUpload} />
      </div>
      <div className="flex" style={{ minHeight }}>
        <div className="select-none text-right px-2 py-2 text-xs text-gray-600 font-mono bg-gray-900/30 border-r border-gray-700/50 min-w-[40px]">
          {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 bg-transparent text-gray-200 text-sm font-mono p-2 outline-none resize-none placeholder-gray-600"
          style={{ minHeight }}
        />
      </div>
    </div>
  )
}

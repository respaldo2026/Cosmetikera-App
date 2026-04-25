param(
  [string]$PayloadPath
)

$ErrorActionPreference = "Stop"

$rawInput = [Console]::In.ReadToEnd()

if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
  $payload = $rawInput | ConvertFrom-Json
}
elseif (-not [string]::IsNullOrWhiteSpace($PayloadPath)) {
  if (-not (Test-Path $PayloadPath)) {
    throw "No existe el archivo de payload"
  }
  $payload = Get-Content $PayloadPath -Raw | ConvertFrom-Json
}
else {
  throw "No se recibió payload"
}
$printerName = [string]$payload.printerName
if ([string]::IsNullOrWhiteSpace($printerName)) {
  $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1
  if (-not $defaultPrinter) {
    throw "No hay impresora predeterminada en Windows"
  }
  $printerName = $defaultPrinter.Name
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@

function Send-RawBytes {
  param(
    [string]$TargetPrinter,
    [byte[]]$Bytes
  )

  $hPrinter = [IntPtr]::Zero
  $doc = New-Object RawPrinterHelper+DOCINFOA
  $doc.pDocName = "LaCosmetikera POS"
  $doc.pDataType = "RAW"

  if (-not [RawPrinterHelper]::OpenPrinter($TargetPrinter, [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "No se pudo abrir la impresora '$TargetPrinter'"
  }

  try {
    if (-not [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $doc)) {
      throw "No se pudo iniciar documento RAW"
    }
    if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) {
      throw "No se pudo iniciar página RAW"
    }

    [int]$written = 0
    if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $Bytes, $Bytes.Length, [ref]$written)) {
      throw "WritePrinter falló"
    }

    [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
    [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null

    return $written
  }
  finally {
    if ($hPrinter -ne [IntPtr]::Zero) {
      [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
    }
  }
}

$action = [string]$payload.action
$encodingName = [string]$payload.encoding
if ([string]::IsNullOrWhiteSpace($encodingName)) {
  $encodingName = "cp1252"
}

if ($encodingName -eq "cp1252") {
  $encodingName = "windows-1252"
}

if ($action -eq "openDrawer") {
  $rawPulse = [byte[]](0x1B,0x70,0x00,0x19,0xFA)
  $written = Send-RawBytes -TargetPrinter $printerName -Bytes $rawPulse
  @{ ok = $true; written = $written; printer = $printerName } | ConvertTo-Json -Compress
  exit 0
}

if ($action -eq "printRaw") {
  $raw = [string]$payload.raw
  if ([string]::IsNullOrEmpty($raw)) {
    throw "raw vacío"
  }

  $enc = [System.Text.Encoding]::GetEncoding($encodingName)
  $bytes = $enc.GetBytes($raw)
  $written = Send-RawBytes -TargetPrinter $printerName -Bytes $bytes
  @{ ok = $true; written = $written; printer = $printerName } | ConvertTo-Json -Compress
  exit 0
}

throw "Acción no soportada: $action"

FROM docker.io/cloudflare/sandbox:0.12.5-python

RUN python3 -m pip install --no-cache-dir \
	openpyxl==3.1.5 \
	python-docx==1.2.0 \
	pypdf==6.15.0 \
	PyMuPDF==1.28.2 \
	reportlab==5.0.0 \
	defusedxml==0.7.1 \
	&& python3 -c "import docx, openpyxl, pymupdf, pypdf, reportlab; print('document toolchain ready')"

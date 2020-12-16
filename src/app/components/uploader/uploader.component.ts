import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Company, CompanyResponse } from 'src/app/interfaces/company.interface';
import { FileUpload } from '../../models/fileupload.model';
import Swal from 'sweetalert2';
import { UploaderService } from './uploader.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
	selector: 'app-uploader',
	templateUrl: './uploader.component.html',
	styleUrls: ['./uploader.component.css']
})
export class UploaderComponent implements OnInit {

	@Input() company: Company;
	@Input() txType: string;
	@Input() cardData: { icon: string, title: string, subtitle: string };
	@Output() companyUpdated = new EventEmitter();

	filesToUpload: FileUpload[] = [];
	maxupload = 12;
	maxSize = 102400;
	estaSobreElemento = false;

	constructor(
		private uploaderService: UploaderService,
		private snack: MatSnackBar
	) {
	}

	ngOnInit() { }

	subirImagenes() {
		let count = 0;
		let filesUploaded = [];
		this.filesToUpload.forEach(archivo => {
			archivo.estaSubiendo = true;
			this.uploaderService.subirImagen(archivo, this.txType, this.company._id).subscribe((data: any) => {

				count++;
				archivo.progreso = 100;
				archivo.estaSubiendo = false;
				filesUploaded.push(data.filename);
				this.company.tx_company_banners.push(data.filename);

				if (count === this.filesToUpload.length) {
					this.filesToUpload = [];
					this.companyUpdated.emit(this.company);
				}

			}, () => {
				// si el archivo que intento subir falla, entonces lo quito del array de archivos a subir
				this.filesToUpload = this.filesToUpload.filter(file => file.nombreArchivo !== archivo.nombreArchivo)
			});
		});

	}

	borrarImagenes() {
		Swal.fire({
			title: '¿Está seguro?',
			text: 'Esta por borrar todas las imagenes de este aviso en el servidor',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			cancelButtonText: 'No, cancelar!',
			confirmButtonText: 'Si, quiero borrarla'
		}).then((result) => {
			if (result.value) {

				this.uploaderService.borrarImagen(this.txType, this.company._id, 'todas').subscribe((data: CompanyResponse) => {
					this.filesToUpload = [];
					this.company.tx_company_banners = data.company.tx_company_banners;
					this.companyUpdated.emit(this.company);
				})

				Swal.fire({
					position: 'center',
					icon: 'success',
					title: 'Eliminada!',
					showConfirmButton: false,
					timer: 700
				});
			}
		});

	}

	borrarImagen(id: string) {
		Swal.fire({
			title: '¿Está seguro?',
			text: 'Esta por borrar una imagen en el servidor',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			cancelButtonText: 'No, cancelar!',
			confirmButtonText: 'Si, quiero borrarla'
		}).then((result) => {
			if (result.value) {
				this.uploaderService.borrarImagen(this.txType, this.company._id, id).subscribe((data: CompanyResponse) => {
					this.company.tx_company_banners = data.company.tx_company_banners;
					this.companyUpdated.emit(this.company);
				});
				Swal.fire({
					position: 'center',
					icon: 'success',
					title: 'Eliminada!',
					showConfirmButton: false,
					timer: 700
				});
			}
		});

	}

	borrarImagenQueue(nombreArchivo) {
		this.filesToUpload = this.filesToUpload.filter(archivo => archivo.nombreArchivo !== nombreArchivo);
	}

	queueFilesInput(event) {
		// permitido: this.maxupload
		// ya cargadas: this.company.tx_company_banners.length
		// listas para subir: this.filesToUpload.length
		// intentando subir: event.target.files.length

		if (this.maxupload - this.company.tx_company_banners.length - this.filesToUpload.length - event.target.files.length < 0) {
			this.snack.open(`Supera el máximo permitido de ${this.maxupload} imágenes`, null, { duration: 3000 })
			return;
		}
		this._extraerArchivos(event.target.files); // le envío un objeto que voy a tener que convertir en array
		this._prevenirDetener(event);
	}

	queueFilesDrop(event) {
		this._extraerArchivos(event.dataTransfer.files); // le envío un objeto que voy a tener que convertir en array
		this._prevenirDetener(event);
	}
	// esta función va a recibir el evento del tipo any
	private _getTransferencia(event: any) {
		/*Esto es para extender la compatibilidad porque hay algunos navegadores que lo manejan directo con
		event.dataTransfer y otros event.originalEvent.dataTrasnfer;*/
		return event.dataTransfer.files ? event.dataTransfer.files : event.originalEvent.dataTransfer.files;
	}

	/*Esta función es para trabajar con los archivos, vamos a extraerlos de la constante "transferencia"*/
	private _extraerArchivos(archivosLista: FileList) {
		// archivosLista: FileList <- OBJETO, LO CONVIERTO A UN ARRAY
		/*Ya puedo recibir UN OBJETO con la información de los archivos soltados, pero ES UN OBJETO y no me sirve tengo
		que extraer la información y devolverla como array. A la función getOwnPropertyNames le mando como argumento el
		objeto que quiero separar. El ciclo for barre cada una de los avisos del objeto archivosLista.
		*/

		// tslint:disable-next-line:forin
		for (const propiedad in Object.getOwnPropertyNames(archivosLista)) {
			const archivoTemporal = archivosLista[propiedad];
			// verifico si el archivo puede ser cargado... podemos crear un nuevo elemento del tipo fileItem
			// dentro del arreglo archivos[]
			if (this._fileCanLoaded(archivoTemporal)) {

				// creo un nuevo objeto de tipo FileUpload que va a contener todos los datos de cada archivo a subir.
				const nuevoArchivo = new FileUpload(archivoTemporal);

				// ademas, voy a guardar dentro de ese objeto, la imagen temporal para poder previsualizarla.
				const reader = new FileReader();
				reader.readAsDataURL(archivoTemporal);
				reader.onloadend = () => (nuevoArchivo.bufferImage = reader.result);

				// push al objeto con los datos, y con el buffer que contiene la imagen.
				this.filesToUpload.push(nuevoArchivo);
			}
		}
		/*En this.filesToUpload ya tengo un arreglo con todos las imagenes para subir, si yo inento cargar por segunda vez un mismo
		archivo no me va a dejar. Ahora lo quiero relacionar con los archivos que tengo en el componente.

		En carga.component.html en el elemento donde tenemos la directiva appNgDropFiles ponemos
		archivos en la directiva -> [archivos]="archivos" <- archivos en el componente
		Javascript pasa por referencia TODOS los objetos, por lo tanto si se modifica en el compoente, se modifica en la directiva.
		Representan al mismo objeto.
	  */
	}

	// validaciones
	// cuando hacemos el DROP queremos que el chrome NO tenga el comportamiento por defecto de abrir la imagen
	private _fileCanLoaded(archivo: File): boolean {
		// si el archivo NO fue ya dropeado... y es una imagen...
		if (!this._fileWasDropped(archivo.name) && this._isImage(archivo.type) && this._sizeOk(archivo.size)) {
			return true;
		} else {
			return false;
		}
	}

	private _prevenirDetener(event: any) {
		event.preventDefault();
		event.stopPropagation();
	}

	// la segunda validación sera que el archivo que estoy dropeando no haya sido ya dropeado.
	private _fileWasDropped(nombreArchivo: string): boolean {
		for (const archivo of this.filesToUpload) {
			if (archivo.nombreArchivo === nombreArchivo) {
				this.snack.open(`El archivo ${nombreArchivo} ya fue cargado.`, null, { duration: 3000 })
				return true;
			}
		}
		return false;
	}

	// verificar que el archivo sea una imagen leyendo el doctype
	// tipoArchivo.startsWith('image'); devuelve 1 si lo encuentra y -1 si no lo encuentra, 1 es true y -1 es interpretado como false.

	private _isImage(tipoArchivo: string): boolean {
		if (tipoArchivo === '' || tipoArchivo === undefined || !tipoArchivo.startsWith('image')) {
			this.snack.open('No es un tipo de archivo de imagen permitido.', null, { duration: 3000 })
			return false;
		}
		return true;
	}

	private _sizeOk(fileSize: number): boolean {
		if (fileSize > this.maxSize) {
			this.snack.open(`El archivo supera el tamaño máximo permitido de ${this.maxSize / 1024} kb`, null, { duration: 3000 })
			return false;
		}
		return true;
	}

}

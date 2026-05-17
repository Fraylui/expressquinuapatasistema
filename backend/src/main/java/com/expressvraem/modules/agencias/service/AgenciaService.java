package com.expressvraem.modules.agencias.service;

import com.expressvraem.modules.agencias.entity.Agencia;
import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AgenciaService {

    private final AgenciaRepository agenciaRepository;

    public List<Agencia> findAll() {
        return agenciaRepository.findByActivo(true);
    }

    public List<Agencia> findAllIncludingInactive() {
        return agenciaRepository.findAll();
    }

    public Agencia findById(Long id) {
        return agenciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agencia", id));
    }

    @Transactional
    public Agencia crear(Agencia agencia) {
        if (agenciaRepository.existsByNombre(agencia.getNombre())) {
            throw new BusinessException("Ya existe una agencia con ese nombre", "AGENCIA_DUPLICADA");
        }
        if (agenciaRepository.existsByCodigo(agencia.getCodigo())) {
            throw new BusinessException("Ya existe una agencia con ese código", "CODIGO_DUPLICADO");
        }
        agencia.setActivo(true);
        return agenciaRepository.save(agencia);
    }

    @Transactional
    public Agencia actualizar(Long id, Agencia datos) {
        Agencia agencia = findById(id);
        agencia.setNombre(datos.getNombre());
        agencia.setDireccion(datos.getDireccion());
        agencia.setCiudad(datos.getCiudad());
        agencia.setDepartamento(datos.getDepartamento());
        agencia.setTelefono(datos.getTelefono());
        agencia.setEmail(datos.getEmail());
        agencia.setRuc(datos.getRuc());
        return agenciaRepository.save(agencia);
    }

    @Transactional
    public void cambiarEstado(Long id, boolean activo) {
        Agencia agencia = findById(id);
        agencia.setActivo(activo);
        agenciaRepository.save(agencia);
    }
}
